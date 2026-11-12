import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { parseMinorUnits, jsonSafe } from '../../shared/money.js';
import { verifyStellarTransaction } from '../../integrations/stellar/stellarService.js';
import { initiateMpesaSTKPush, verifyMpesaCallback } from '../../integrations/mpesa/mpesaService.js';
import { isAuthorizedDarajaIp, validateStkCallbackPayload } from '../../integrations/mpesa/mpesaSecurity.js';
import { SouthAfricaEftPaymentProvider } from '../../integrations/providers/paymentProvider.js';
import { agenticFinanceEngine } from '../agent/agentService.js';

const router = Router();

// -------------------------------------------------------------
// Unauthenticated Webhook: Safaricom M-Pesa Callback
// -------------------------------------------------------------
router.post('/payments/mpesa-callback', asyncHandler(async (req, res) => {
  if (!isAuthorizedDarajaIp(req.ip)) {
    throw new AppError(`Unauthorized Daraja webhook source IP: ${req.ip}`, 403);
  }

  const payloadValidation = validateStkCallbackPayload(req.body);
  if (!payloadValidation.valid) {
    throw new AppError(`Invalid M-Pesa callback envelope: ${payloadValidation.error}`, 400);
  }

  const verified = verifyMpesaCallback({ callbackBody: req.body });
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { checkoutRequestId: verified.checkoutRequestId },
        { providerRef: verified.checkoutRequestId }
      ]
    },
    include: { obligation: true }
  });

  if (!payment) {
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (payment.status === 'CONFIRMED') {
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Already confirmed' });
  }

  // Validate amount matches expected payment attempt
  const expectedWhole = Math.round(Number(payment.amountMinor) / 100);
  if (verified.amountPaid !== null && verified.amountPaid !== expectedWhole) {
    throw new AppError(
      `M-Pesa payment amount mismatch: expected ${expectedWhole} KES, received ${verified.amountPaid} KES.`,
      400
    );
  }

  await prisma.$transaction(async tx => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        providerRef: verified.receiptNumber,
        checkoutRequestId: verified.checkoutRequestId,
        merchantRequestId: verified.merchantRequestId,
        mpesaReceiptNumber: verified.receiptNumber,
        metadata: {
          checkoutRequestId: verified.checkoutRequestId,
          merchantRequestId: verified.merchantRequestId,
          receiptNumber: verified.receiptNumber,
          phoneNumber: verified.phoneNumber,
          resultDesc: verified.resultDesc
        }
      }
    });

    const settlement = await tx.settlement.create({
      data: {
        workspaceId: payment.workspaceId,
        obligationId: payment.obligationId,
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        rail: 'MPESA',
        externalRef: verified.receiptNumber
      }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: payment.workspaceId,
        reference: `SETTLEMENT-MPESA-${settlement.id}`,
        description: `Verified Safaricom M-Pesa settlement (${verified.receiptNumber}) for obligation ${payment.obligationId}`,
        lines: {
          create: [
            { accountCode: '1010-MPESA-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
            { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: payment.workspaceId,
        actorId: null,
        action: 'PAYMENT_CONFIRMED_MPESA_CALLBACK',
        entityType: 'Payment',
        entityId: payment.id,
        details: { receiptNumber: verified.receiptNumber, journalEntryId: journal.id }
      }
    });

    const total = await tx.settlement.aggregate({
      where: { obligationId: payment.obligationId },
      _sum: { amountMinor: true }
    });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: payment.obligationId }, data: { status } });
  });

  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
}));

// -------------------------------------------------------------
// Unauthenticated Webhook: South Africa PayShap / EFT Provider
// -------------------------------------------------------------
router.post('/payments/payshap-webhook', asyncHandler(async (req, res) => {
  const provider = new SouthAfricaEftPaymentProvider();
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['x-payshap-signature'] || req.headers['x-signature'] || req.body.signature;
  const timestamp = req.headers['x-timestamp'] || req.body.timestamp;

  const verified = await provider.verifyEvent({
    webhookPayload: req.body,
    signature,
    timestamp,
    rawBody
  });

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { providerRef: verified.referenceNumber },
        { id: req.body.paymentId || 'NONE' }
      ]
    },
    include: { obligation: true }
  });

  if (!payment) {
    return res.status(200).json({ status: 'ACCEPTED', message: 'No matching payment intent found.' });
  }

  if (payment.status === 'CONFIRMED') {
    return res.status(200).json({ status: 'ALREADY_CONFIRMED', paymentId: payment.id });
  }

  // Exact minor amount check
  if (BigInt(payment.amountMinor) !== BigInt(verified.amountMinor)) {
    throw new AppError(`PayShap settlement amount mismatch: expected ${payment.amountMinor} minor units, received ${verified.amountMinor}.`, 400);
  }

  await prisma.$transaction(async tx => {
    const existingSettlement = await tx.settlement.findUnique({
      where: { externalRef: verified.providerTransactionId }
    });
    if (existingSettlement) {
      throw new AppError(`PayShap transaction ${verified.providerTransactionId} has already been settled.`, 409);
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        providerRef: verified.providerTransactionId,
        metadata: {
          ...(payment.metadata || {}),
          payshap: verified
        }
      }
    });

    const settlement = await tx.settlement.create({
      data: {
        workspaceId: payment.workspaceId,
        obligationId: payment.obligationId,
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        rail: 'PAYSHAP_EFT',
        externalRef: verified.providerTransactionId
      }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: payment.workspaceId,
        reference: `SETTLEMENT-PAYSHAP-${settlement.id}`,
        description: `Verified PayShap settlement (${verified.providerTransactionId}) for obligation ${payment.obligationId}`,
        lines: {
          create: [
            { accountCode: '1030-PAYSHAP-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
            { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: payment.workspaceId,
        actorId: null,
        action: 'PAYMENT_CONFIRMED_PAYSHAP_WEBHOOK',
        entityType: 'Payment',
        entityId: payment.id,
        details: { providerTransactionId: verified.providerTransactionId, journalEntryId: journal.id }
      }
    });

    const total = await tx.settlement.aggregate({
      where: { obligationId: payment.obligationId },
      _sum: { amountMinor: true }
    });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: payment.obligationId }, data: { status } });
  });

  res.status(200).json({ status: 'SUCCESS', transactionId: verified.providerTransactionId });
}));

// -------------------------------------------------------------
// Authenticated Finance Routes
// -------------------------------------------------------------
router.use(authenticate);

async function audit(tx, workspaceId, actorId, action, entityType, entityId, details = {}) {
  await tx.auditLog.create({
    data: { workspaceId, actorId, action, entityType, entityId, details }
  });
}

async function requireWorkspaceRoleByObligation(req, _res, next) {
  try {
    const obligation = await prisma.obligation.findUnique({ where: { id: req.params.id } });
    if (!obligation) throw new AppError('Obligation not found.', 404);
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId: obligation.workspaceId } }
    });
    if (!membership) throw new AppError('Workspace access denied.', 403);
    req.obligation = obligation;
    req.membership = membership;
    next();
  } catch (e) { next(e); }
}

// -------------------------------------------------------------
// Obligations Endpoints
// -------------------------------------------------------------
router.get('/workspaces/:workspaceId/obligations', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const obligations = await prisma.obligation.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { settlements: true, payments: true, campaign: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ obligations: jsonSafe(obligations) });
}));

router.get('/obligations/:id', requireWorkspaceRoleByObligation, asyncHandler(async (req, res) => {
  const obligation = await prisma.obligation.findUnique({
    where: { id: req.params.id },
    include: { settlements: true, payments: true, campaign: true }
  });
  res.json({ obligation: jsonSafe(obligation) });
}));

router.post('/workspaces/:workspaceId/obligations', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const data = z.object({
    campaignId: z.string().optional(),
    title: z.string().trim().min(2).max(120),
    description: z.string().max(1000).optional(),
    memberName: z.string().trim().min(2).max(100),
    memberEmail: z.string().email().optional(),
    amount: z.union([z.string(), z.number()]),
    dueAt: z.string().datetime().optional()
  }).parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const obligation = await prisma.obligation.create({
    data: {
      workspaceId: workspace.id,
      campaignId: data.campaignId,
      title: data.title,
      description: data.description,
      memberName: data.memberName,
      memberEmail: data.memberEmail,
      amountMinor: parseMinorUnits(data.amount),
      currency: workspace.currency,
      dueAt: data.dueAt ? new Date(data.dueAt) : null
    }
  });

  await prisma.auditLog.create({
    data: { workspaceId: workspace.id, actorId: req.user.id, action: 'OBLIGATION_CREATED', entityType: 'Obligation', entityId: obligation.id }
  });

  res.status(201).json({ obligation: jsonSafe(obligation) });
}));

router.post('/obligations/:id/cancel', requireWorkspaceRoleByObligation, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const obligation = req.obligation;
  if (obligation.status === 'SETTLED') throw new AppError('Settled obligations cannot be cancelled.', 400);

  const updated = await prisma.obligation.update({
    where: { id: obligation.id },
    data: { status: 'CANCELLED' }
  });

  await prisma.auditLog.create({
    data: { workspaceId: obligation.workspaceId, actorId: req.user.id, action: 'OBLIGATION_CANCELLED', entityType: 'Obligation', entityId: obligation.id }
  });

  res.json({ obligation: jsonSafe(updated) });
}));

// -------------------------------------------------------------
// Payments & Settlement Endpoints
// -------------------------------------------------------------
router.post('/obligations/:id/payments', requireWorkspaceRoleByObligation, asyncHandler(async (req, res) => {
  const data = z.object({
    rail: z.enum(['DEVELOPMENT', 'STELLAR', 'MPESA', 'PAYSHAP_EFT']),
    idempotencyKey: z.string().min(8).max(100).optional(),
    phoneNumber: z.string().optional()
  }).parse(req.body);

  if (data.rail === 'DEVELOPMENT' && env.PAYMENT_MODE !== 'development') {
    throw new AppError('Development payments are disabled in non-development mode.', 403);
  }

  const obligation = req.obligation;
  if (obligation.status === 'CANCELLED') throw new AppError('This obligation has been cancelled.', 400);

  const settled = await prisma.settlement.aggregate({
    where: { obligationId: obligation.id },
    _sum: { amountMinor: true }
  });
  const outstanding = obligation.amountMinor - (settled._sum.amountMinor || 0n);
  if (outstanding <= 0n) throw new AppError('This obligation is already settled.', 409);

  const pending = await prisma.payment.findFirst({
    where: { obligationId: obligation.id, status: { in: ['PENDING', 'PROCESSING'] } }
  });
  if (pending) throw new AppError('A payment attempt is already pending for this obligation.', 409);

  const idempotencyKey = data.idempotencyKey || randomUUID();
  let metadata = null;
  let providerRef = null;

  if (data.rail === 'STELLAR') {
    metadata = {
      memo: `HESABU-${obligation.id.slice(0, 8)}`,
      network: env.STELLAR_NETWORK
    };
  } else if (data.rail === 'PAYSHAP_EFT') {
    providerRef = `ZA-EFT-${obligation.id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    metadata = {
      paymentReference: providerRef,
      country: 'ZA'
    };
  }

  // Step 1: Create durable Payment intent in database FIRST
  let payment = await prisma.payment.create({
    data: {
      workspaceId: obligation.workspaceId,
      obligationId: obligation.id,
      rail: data.rail,
      amountMinor: outstanding,
      currency: obligation.currency,
      idempotencyKey,
      providerRef,
      metadata,
      status: 'PENDING'
    }
  });

  // Step 2: If M-Pesa rail, initiate STK push and update payment with provider references
  if (data.rail === 'MPESA') {
    if (data.phoneNumber) {
      try {
        const stk = await initiateMpesaSTKPush({
          phoneNumber: data.phoneNumber,
          amountMinor: outstanding,
          accountReference: obligation.id.slice(0, 12),
          transactionDesc: obligation.title
        });
        payment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerRef: stk.checkoutRequestId,
            checkoutRequestId: stk.checkoutRequestId,
            merchantRequestId: stk.merchantRequestId,
            status: 'PROCESSING',
            metadata: {
              phoneNumber: data.phoneNumber,
              checkoutRequestId: stk.checkoutRequestId,
              merchantRequestId: stk.merchantRequestId,
              customerMessage: stk.customerMessage
            }
          }
        });
      } catch (err) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', metadata: { error: err.message } }
        });
        throw err;
      }
    }
  }

  const notice = data.rail === 'DEVELOPMENT'
    ? 'Development payment attempt registered.'
    : data.rail === 'STELLAR'
    ? 'Stellar payment attempt registered. Awaiting on-chain transaction hash.'
    : data.rail === 'PAYSHAP_EFT'
    ? 'South Africa PayShap/EFT payment reference generated. Awaiting bank settlement.'
    : 'M-Pesa payment attempt registered. Awaiting callback or carrier confirmation.';

  res.status(201).json({ payment: jsonSafe(payment), notice });
}));

// Development confirmation (strict dev mode check)
router.post('/payments/:id/dev-confirm', asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production' || env.PAYMENT_MODE !== 'development') {
    throw new AppError('Development confirmation is strictly prohibited in production and live payment environments.', 403);
  }
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { obligation: true } });
  if (!payment) throw new AppError('Payment not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: payment.workspaceId } }
  });
  if (!membership) throw new AppError('Workspace access denied.', 403);
  if (payment.status === 'CONFIRMED') return res.json({ payment: jsonSafe(payment), message: 'Already confirmed.' });

  const result = await prisma.$transaction(async tx => {
    const current = await tx.payment.findUnique({ where: { id: payment.id } });
    if (current.status === 'CONFIRMED') return current;
    const existing = await tx.settlement.findUnique({ where: { paymentId: current.id } });
    if (existing) throw new AppError('Settlement already exists.', 409);

    const updated = await tx.payment.update({
      where: { id: current.id },
      data: { status: 'CONFIRMED', providerRef: `DEV-${current.id}` }
    });
    const settlement = await tx.settlement.create({
      data: {
        workspaceId: current.workspaceId,
        obligationId: current.obligationId,
        paymentId: current.id,
        amountMinor: current.amountMinor,
        currency: current.currency,
        rail: current.rail,
        externalRef: `DEV-${current.id}`
      }
    });
    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: current.workspaceId,
        reference: `SETTLEMENT-${settlement.id}`,
        description: `Verified development settlement for obligation ${current.obligationId}`,
        lines: { create: [
          { accountCode: '1000-CASH-CLEARING', side: 'DEBIT', amountMinor: current.amountMinor, currency: current.currency },
          { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: current.amountMinor, currency: current.currency }
        ]}
      }
    });
    await audit(tx, current.workspaceId, req.user.id, 'PAYMENT_CONFIRMED_DEV', 'Payment', current.id, { journalEntryId: journal.id });
    const total = await tx.settlement.aggregate({ where: { obligationId: current.obligationId }, _sum: { amountMinor: true } });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: current.obligationId }, data: { status } });
    return updated;
  });

  res.json({ payment: jsonSafe(result), notice: 'Development simulated settlement recorded.' });
}));

// Real Stellar on-chain verification
router.post('/payments/:id/stellar-confirm', asyncHandler(async (req, res) => {
  const data = z.object({
    txHash: z.string().trim().length(64)
  }).parse(req.body);

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { obligation: true } });
  if (!payment) throw new AppError('Payment not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: payment.workspaceId } }
  });
  if (!membership) throw new AppError('Workspace access denied.', 403);
  if (payment.status === 'CONFIRMED') return res.json({ payment: jsonSafe(payment), message: 'Already confirmed on Stellar.' });

  const verification = await verifyStellarTransaction({
    txHash: data.txHash,
    expectedMemo: payment.metadata?.memo,
    expectedAmountMinor: payment.amountMinor,
    expectedAssetCode: payment.currency === 'KES' ? 'KES' : 'USDC'
  });

  const result = await prisma.$transaction(async tx => {
    const existingTx = await tx.payment.findFirst({
      where: { txHash: data.txHash, status: 'CONFIRMED', NOT: { id: payment.id } }
    });
    if (existingTx) throw new AppError('This Stellar transaction hash has already settled an obligation.', 409);

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        txHash: data.txHash,
        providerRef: data.txHash,
        metadata: { ...(payment.metadata || {}), verification }
      }
    });

    const settlement = await tx.settlement.create({
      data: {
        workspaceId: payment.workspaceId,
        obligationId: payment.obligationId,
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        rail: 'STELLAR',
        externalRef: data.txHash
      }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: payment.workspaceId,
        reference: `SETTLEMENT-STELLAR-${settlement.id}`,
        description: `Verified Stellar network settlement (${data.txHash.slice(0, 16)}...) for obligation ${payment.obligationId}`,
        lines: { create: [
          { accountCode: '1000-STELLAR-USDC-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
          { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency }
        ]}
      }
    });

    await audit(tx, payment.workspaceId, req.user.id, 'PAYMENT_CONFIRMED_STELLAR', 'Payment', payment.id, {
      txHash: data.txHash,
      journalEntryId: journal.id
    });

    const total = await tx.settlement.aggregate({ where: { obligationId: payment.obligationId }, _sum: { amountMinor: true } });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: payment.obligationId }, data: { status } });

    return updated;
  });

  res.json({ payment: jsonSafe(result), verification: jsonSafe(verification), notice: 'On-chain Stellar transaction independently verified and posted to journal.' });
}));

// M-Pesa manual/carrier confirmation (Restricted to Finance Managers / Admins with audit trail)
router.post('/payments/:id/mpesa-confirm', asyncHandler(async (req, res) => {
  const data = z.object({
    receiptNumber: z.string().trim().min(8).max(30).regex(/^[A-Z0-9]+$/, 'Receipt number must be alphanumeric (e.g. QA12345678).'),
    phoneNumber: z.string().optional()
  }).parse(req.body);

  const cleanReceipt = data.receiptNumber.toUpperCase();

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { obligation: true } });
  if (!payment) throw new AppError('Payment not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: payment.workspaceId } }
  });
  if (!membership) throw new AppError('Workspace access denied.', 403);
  if (!['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Only workspace Owners, Admins, or Finance Managers can confirm manual M-Pesa settlements. Members should submit via /claim-manual.', 403);
  }
  if (payment.status === 'CONFIRMED') return res.json({ payment: jsonSafe(payment), message: 'Already confirmed via M-Pesa.' });

  const result = await prisma.$transaction(async tx => {
    const existingRef = await tx.settlement.findUnique({ where: { externalRef: cleanReceipt } });
    if (existingRef) throw new AppError(`M-Pesa receipt ${cleanReceipt} has already been registered and settled.`, 409);

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        providerRef: cleanReceipt,
        mpesaReceiptNumber: cleanReceipt,
        metadata: { ...(payment.metadata || {}), receiptNumber: cleanReceipt, phoneNumber: data.phoneNumber, verifiedBy: req.user.id }
      }
    });

    const settlement = await tx.settlement.create({
      data: {
        workspaceId: payment.workspaceId,
        obligationId: payment.obligationId,
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        rail: 'MPESA',
        externalRef: cleanReceipt
      }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: payment.workspaceId,
        reference: `SETTLEMENT-MPESA-${settlement.id}`,
        description: `Verified M-Pesa settlement (${cleanReceipt}) for obligation ${payment.obligationId}`,
        lines: { create: [
          { accountCode: '1010-MPESA-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
          { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency }
        ]}
      }
    });

    await audit(tx, payment.workspaceId, req.user.id, 'PAYMENT_CONFIRMED_MPESA_MANUAL', 'Payment', payment.id, {
      receiptNumber: cleanReceipt,
      journalEntryId: journal.id
    });

    const total = await tx.settlement.aggregate({ where: { obligationId: payment.obligationId }, _sum: { amountMinor: true } });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: payment.obligationId }, data: { status } });

    return updated;
  });

  res.json({ payment: jsonSafe(result), receiptNumber: cleanReceipt, notice: 'M-Pesa receipt verified by administrator and posted to journal.' });
}));

// PayShap / South Africa EFT confirmation (Restricted to Finance Managers / Admins with audit trail)
router.post('/payments/:id/payshap-confirm', asyncHandler(async (req, res) => {
  const data = z.object({
    clearingRef: z.string().trim().min(6).max(40).regex(/^[A-Z0-9_-]+$/i, 'Clearing reference must be alphanumeric.'),
    bankName: z.string().optional(),
    auditReason: z.string().trim().min(5, 'Audit justification rationale is required.')
  }).parse(req.body);

  const cleanRef = data.clearingRef.toUpperCase();

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { obligation: true } });
  if (!payment) throw new AppError('Payment not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: payment.workspaceId } }
  });
  if (!membership) throw new AppError('Workspace access denied.', 403);
  if (!['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Only workspace Owners, Admins, or Finance Managers can confirm South African EFT/PayShap settlements.', 403);
  }
  if (payment.status === 'CONFIRMED') return res.json({ payment: jsonSafe(payment), message: 'Already confirmed via PayShap/EFT.' });

  const result = await prisma.$transaction(async tx => {
    const existingRef = await tx.settlement.findUnique({ where: { externalRef: cleanRef } });
    if (existingRef) throw new AppError(`PayShap/EFT clearing reference ${cleanRef} has already been registered and settled.`, 409);

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        providerRef: cleanRef,
        metadata: {
          ...(payment.metadata || {}),
          clearingRef: cleanRef,
          bankName: data.bankName,
          verifiedBy: req.user.id,
          auditReason: data.auditReason
        }
      }
    });

    const settlement = await tx.settlement.create({
      data: {
        workspaceId: payment.workspaceId,
        obligationId: payment.obligationId,
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        rail: 'PAYSHAP_EFT',
        externalRef: cleanRef
      }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: payment.workspaceId,
        reference: `SETTLEMENT-PAYSHAP-${settlement.id}`,
        description: `Verified PayShap/EFT settlement (${cleanRef}) for obligation ${payment.obligationId} by ${req.user.id}`,
        lines: { create: [
          { accountCode: '1030-PAYSHAP-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
          { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency }
        ]}
      }
    });

    await audit(tx, payment.workspaceId, req.user.id, 'PAYMENT_CONFIRMED_PAYSHAP_MANUAL', 'Payment', payment.id, {
      clearingRef: cleanRef,
      bankName: data.bankName,
      auditReason: data.auditReason,
      journalEntryId: journal.id
    });

    const total = await tx.settlement.aggregate({ where: { obligationId: payment.obligationId }, _sum: { amountMinor: true } });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: payment.obligationId }, data: { status } });

    return updated;
  });

  res.json({ payment: jsonSafe(result), clearingRef: cleanRef, notice: 'PayShap/EFT payment verified by administrator and posted to journal.' });
}));

// Member unverified manual payment claim submission
router.post('/payments/:id/claim-manual', asyncHandler(async (req, res) => {
  const data = z.object({
    receiptNumber: z.string().trim().min(6).max(40),
    phoneNumber: z.string().optional(),
    notes: z.string().optional()
  }).parse(req.body);

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { obligation: true } });
  if (!payment) throw new AppError('Payment not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: payment.workspaceId } }
  });
  if (!membership) throw new AppError('Workspace access denied.', 403);

  const cleanReceipt = data.receiptNumber.toUpperCase();

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      metadata: {
        ...(payment.metadata || {}),
        manualClaim: {
          receiptNumber: cleanReceipt,
          phoneNumber: data.phoneNumber,
          notes: data.notes,
          submittedBy: req.user.id,
          submittedAt: new Date().toISOString()
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: payment.workspaceId,
      actorId: req.user.id,
      action: 'PAYMENT_MANUAL_CLAIM_SUBMITTED',
      entityType: 'Payment',
      entityId: payment.id,
      details: { receiptNumber: cleanReceipt }
    }
  });

  res.json({ payment: jsonSafe(updated), notice: 'Offline payment claim submitted for treasurer verification.' });
}));

// South Africa PayShap / EFT payment settlement
router.post('/payments/:id/payshap-confirm', asyncHandler(async (req, res) => {
  const data = z.object({
    bankReference: z.string().trim().min(6).max(40)
  }).parse(req.body);

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { obligation: true, workspace: true } });
  if (!payment) throw new AppError('Payment not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: payment.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Only finance managers can confirm South African EFT settlements.', 403);
  }
  if (payment.status === 'CONFIRMED') return res.json({ payment: jsonSafe(payment), message: 'Already confirmed.' });

  const cleanRef = data.bankReference.toUpperCase();

  const result = await prisma.$transaction(async tx => {
    const existingRef = await tx.settlement.findUnique({ where: { externalRef: cleanRef } });
    if (existingRef) throw new AppError(`Bank reference ${cleanRef} has already settled a payment.`, 409);

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        providerRef: cleanRef,
        metadata: { ...(payment.metadata || {}), bankReference: cleanRef }
      }
    });

    const settlement = await tx.settlement.create({
      data: {
        workspaceId: payment.workspaceId,
        obligationId: payment.obligationId,
        paymentId: payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        rail: 'PAYSHAP_EFT',
        externalRef: cleanRef
      }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: payment.workspaceId,
        reference: `SETTLEMENT-EFT-${settlement.id}`,
        description: `Verified South Africa PayShap/EFT settlement (${cleanRef}) for obligation ${payment.obligationId}`,
        lines: { create: [
          { accountCode: '1030-BANK-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
          { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency }
        ]}
      }
    });

    await audit(tx, payment.workspaceId, req.user.id, 'PAYMENT_CONFIRMED_EFT', 'Payment', payment.id, {
      bankReference: cleanRef,
      journalEntryId: journal.id
    });

    const total = await tx.settlement.aggregate({ where: { obligationId: payment.obligationId }, _sum: { amountMinor: true } });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: payment.obligationId }, data: { status } });

    return updated;
  });

  res.json({ payment: jsonSafe(result), notice: 'South Africa PayShap/EFT settlement verified and posted to journal.' });
}));

router.get('/workspaces/:workspaceId/payments', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { obligation: true, settlement: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ payments: jsonSafe(payments) });
}));

// -------------------------------------------------------------
// Expenses, Splits & Multi-Party Approvals
// -------------------------------------------------------------
router.get('/workspaces/:workspaceId/expenses', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { splits: true, approvals: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ expenses: jsonSafe(expenses) });
}));

router.post('/workspaces/:workspaceId/expenses', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const data = z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().max(1000).optional(),
    category: z.string().trim().min(2).max(60),
    amount: z.union([z.string(), z.number()]),
    receiptUrl: z.string().url().optional(),
    splits: z.array(z.object({
      memberName: z.string().trim().min(2),
      memberEmail: z.string().email().optional(),
      amount: z.union([z.string(), z.number()])
    })).optional()
  }).parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const amountMinor = parseMinorUnits(data.amount);

  const expense = await prisma.expense.create({
    data: {
      workspaceId: workspace.id,
      title: data.title,
      description: data.description,
      category: data.category,
      amountMinor,
      currency: workspace.currency,
      submittedById: req.user.id,
      receiptUrl: data.receiptUrl,
      splits: data.splits && data.splits.length > 0 ? {
        create: data.splits.map(s => ({
          memberName: s.memberName,
          memberEmail: s.memberEmail,
          amountMinor: parseMinorUnits(s.amount)
        }))
      } : undefined
    },
    include: { splits: true }
  });

  await prisma.auditLog.create({
    data: { workspaceId: workspace.id, actorId: req.user.id, action: 'EXPENSE_SUBMITTED', entityType: 'Expense', entityId: expense.id }
  });

  res.status(201).json({ expense: jsonSafe(expense) });
}));

router.post('/expenses/:id/approve', asyncHandler(async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) throw new AppError('Expense not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: expense.workspaceId } },
    include: { user: true }
  });
  if (!membership || !['OWNER', 'ADMIN', 'APPROVER', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Approval permission required.', 403);
  }
  if (expense.submittedById === req.user.id && membership.role !== 'OWNER') {
    throw new AppError('Separation of duties: you cannot approve your own expense submission.', 403);
  }

  const updated = await prisma.$transaction(async tx => {
    await tx.expenseApproval.create({
      data: {
        expenseId: expense.id,
        reviewerId: req.user.id,
        reviewerName: membership.user.name,
        status: 'APPROVED',
        note: 'Approved by authorized officer'
      }
    });

    return await tx.expense.update({
      where: { id: expense.id },
      data: { status: 'APPROVED', approvedById: req.user.id }
    });
  });

  await prisma.auditLog.create({
    data: { workspaceId: expense.workspaceId, actorId: req.user.id, action: 'EXPENSE_APPROVED', entityType: 'Expense', entityId: expense.id }
  });

  res.json({ expense: jsonSafe(updated) });
}));

router.post('/expenses/:id/reject', asyncHandler(async (req, res) => {
  const data = z.object({ note: z.string().trim().min(3).max(500) }).parse(req.body);
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) throw new AppError('Expense not found.', 404);
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: expense.workspaceId } },
    include: { user: true }
  });
  if (!membership || !['OWNER', 'ADMIN', 'APPROVER', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Approval permission required.', 403);
  }

  const updated = await prisma.$transaction(async tx => {
    await tx.expenseApproval.create({
      data: {
        expenseId: expense.id,
        reviewerId: req.user.id,
        reviewerName: membership.user.name,
        status: 'REJECTED',
        note: data.note
      }
    });

    return await tx.expense.update({
      where: { id: expense.id },
      data: { status: 'REJECTED', approvedById: req.user.id, approvalNote: data.note }
    });
  });

  await prisma.auditLog.create({
    data: { workspaceId: expense.workspaceId, actorId: req.user.id, action: 'EXPENSE_REJECTED', entityType: 'Expense', entityId: expense.id }
  });

  res.json({ expense: jsonSafe(updated) });
}));

// Expense Payout / Reimbursement posting to Ledger
router.post('/expenses/:id/pay', asyncHandler(async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) throw new AppError('Expense not found.', 404);
  if (expense.status !== 'APPROVED') throw new AppError('Expense must be approved before payout.', 400);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: expense.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Permission required to pay out expenses.', 403);
  }

  const result = await prisma.$transaction(async tx => {
    const updated = await tx.expense.update({
      where: { id: expense.id },
      data: { status: 'PAID' }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: expense.workspaceId,
        reference: `EXPENSE-PAYOUT-${expense.id}`,
        description: `Expense payout for ${expense.title} (${expense.category})`,
        lines: { create: [
          { accountCode: '5000-OPERATING-EXPENSES', side: 'DEBIT', amountMinor: expense.amountMinor, currency: expense.currency },
          { accountCode: '1000-CASH-CLEARING', side: 'CREDIT', amountMinor: expense.amountMinor, currency: expense.currency }
        ]}
      }
    });

    await audit(tx, expense.workspaceId, req.user.id, 'EXPENSE_PAID', 'Expense', expense.id, { journalEntryId: journal.id });
    return updated;
  });

  res.json({ expense: jsonSafe(result), notice: 'Expense marked paid and posted to double-entry ledger.' });
}));

// -------------------------------------------------------------
// Double-entry Journal & Audit Logs & Reversal
// -------------------------------------------------------------
router.get('/workspaces/:workspaceId/journal', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const entries = await prisma.journalEntry.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { lines: true },
    orderBy: { postedAt: 'desc' }
  });
  res.json({ entries: jsonSafe(entries) });
}));

// GAAP/IFRS Journal Entry Reversal Workflow
router.post('/journal/:id/reverse', asyncHandler(async (req, res) => {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: req.params.id },
    include: { lines: true }
  });
  if (!entry) throw new AppError('Journal entry not found.', 404);
  if (entry.status === 'REVERSED') throw new AppError('This journal entry has already been reversed.', 400);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: entry.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Permission required to reverse journal entries.', 403);
  }

  const result = await prisma.$transaction(async tx => {
    // 1. Mark original entry reversed
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { status: 'REVERSED' }
    });

    // 2. Create the exact reversing entry with flipped sides (Debit <-> Credit)
    const reversingEntry = await tx.journalEntry.create({
      data: {
        workspaceId: entry.workspaceId,
        reference: `REVERSAL-${entry.reference}`,
        description: `Reversal of entry ${entry.reference}: ${entry.description}`,
        reversedEntryId: entry.id,
        lines: {
          create: entry.lines.map(l => ({
            accountCode: l.accountCode,
            side: l.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
            amountMinor: l.amountMinor,
            currency: l.currency
          }))
        }
      },
      include: { lines: true }
    });

    await audit(tx, entry.workspaceId, req.user.id, 'JOURNAL_REVERSED', 'JournalEntry', entry.id, {
      originalReference: entry.reference,
      reversalReference: reversingEntry.reference
    });

    return reversingEntry;
  });

  res.json({ reversingEntry: jsonSafe(result), notice: 'Journal entry reversed with balanced counter-entry.' });
}));

// Financial Statements: Trial Balance (Multi-Currency Aware)
router.get('/workspaces/:workspaceId/reports/trial-balance', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const entries = await prisma.journalEntry.findMany({
    where: { workspaceId: req.params.workspaceId, status: 'POSTED' },
    include: { lines: true }
  });

  const accounts = {};
  const currencyTotals = {};
  let grandTotalDebits = 0n;
  let grandTotalCredits = 0n;

  for (const entry of entries) {
    for (const line of entry.lines) {
      const c = line.currency;
      if (!currencyTotals[c]) {
        currencyTotals[c] = { debitsMinor: 0n, creditsMinor: 0n };
      }

      if (!accounts[line.accountCode]) {
        accounts[line.accountCode] = { accountCode: line.accountCode, debitMinor: 0n, creditMinor: 0n, currency: line.currency };
      }
      if (line.side === 'DEBIT') {
        accounts[line.accountCode].debitMinor += line.amountMinor;
        currencyTotals[c].debitsMinor += line.amountMinor;
        grandTotalDebits += line.amountMinor;
      } else {
        accounts[line.accountCode].creditMinor += line.amountMinor;
        currencyTotals[c].creditsMinor += line.amountMinor;
        grandTotalCredits += line.amountMinor;
      }
    }
  }

  const allCurrenciesBalanced = Object.values(currencyTotals).every(ct => ct.debitsMinor === ct.creditsMinor);

  res.json({
    trialBalance: {
      accounts: Object.values(accounts).map(a => ({
        accountCode: a.accountCode,
        debitMinor: a.debitMinor.toString(),
        creditMinor: a.creditMinor.toString(),
        currency: a.currency
      })),
      totalDebitsMinor: grandTotalDebits.toString(),
      totalCreditsMinor: grandTotalCredits.toString(),
      isBalanced: grandTotalDebits === grandTotalCredits && allCurrenciesBalanced,
      currencyBreakdown: Object.fromEntries(
        Object.entries(currencyTotals).map(([c, totals]) => [
          c,
          {
            debitsMinor: totals.debitsMinor.toString(),
            creditsMinor: totals.creditsMinor.toString(),
            balanced: totals.debitsMinor === totals.creditsMinor
          }
        ])
      )
    }
  });
}));

// Financial Statements: Income Statement (P&L) (Multi-Currency Aware)
router.get('/workspaces/:workspaceId/reports/income-statement', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const [settlements, expenses] = await Promise.all([
    prisma.settlement.findMany({ where: { workspaceId } }),
    prisma.expense.findMany({ where: { workspaceId, status: { in: ['APPROVED', 'PAID'] } } })
  ]);

  const totalRevenueMinor = settlements.reduce((sum, s) => sum + s.amountMinor, 0n);
  const expensesByCategory = {};
  let totalExpenseMinor = 0n;

  for (const e of expenses) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0n) + e.amountMinor;
    totalExpenseMinor += e.amountMinor;
  }

  const netSurplusMinor = totalRevenueMinor - totalExpenseMinor;

  res.json({
    incomeStatement: {
      totalRevenueMinor: totalRevenueMinor.toString(),
      totalExpenseMinor: totalExpenseMinor.toString(),
      netSurplusMinor: netSurplusMinor.toString(),
      expensesByCategory: Object.fromEntries(
        Object.entries(expensesByCategory).map(([k, v]) => [k, v.toString()])
      )
    }
  });
}));

router.get('/workspaces/:workspaceId/audit', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json({ auditLogs: jsonSafe(logs) });
}));

router.get('/workspaces/:workspaceId/reports/ledger.csv', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const entries = await prisma.journalEntry.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { lines: true },
    orderBy: { postedAt: 'asc' }
  });
  const rows = [['date','reference','description','account','side','amount_minor','currency']];
  for (const entry of entries) for (const line of entry.lines) {
    rows.push([
      entry.postedAt.toISOString(),
      entry.reference,
      entry.description,
      line.accountCode,
      line.side,
      line.amountMinor.toString(),
      line.currency
    ]);
  }
  const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="hesabu-ledger.csv"');
  res.send(csv);
}));

// -------------------------------------------------------------
// Interactive Agentic Financial Copilot
// -------------------------------------------------------------
router.post('/workspaces/:workspaceId/agent/query', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const { question } = z.object({ question: z.string().trim().min(3).max(500) }).parse(req.body);
  const workspaceId = req.params.workspaceId;

  const result = await agenticFinanceEngine.handleQuery({ workspaceId, question });

  res.json({
    response: {
      question: result.question,
      answer: result.answer,
      agentInvoked: result.agentInvoked,
      metrics: result.metrics,
      toolData: result.toolData,
      timestamp: new Date().toISOString()
    }
  });
}));

router.get('/workspaces/:workspaceId/agent/reconcile', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const result = await agenticFinanceEngine.runReconciliationAgent({ workspaceId });

  res.json({
    insights: {
      generatedAt: result.timestamp,
      agentRole: 'Autonomous Financial Reconciliation & Intelligence Agent',
      reconciliationHealth: result.health,
      matchedSettlementsCount: result.matchedCount,
      unmatchedSettlementsCount: result.unmatchedCount,
      stuckPaymentsCount: result.stuckPaymentsCount,
      unbalancedCurrencies: result.unbalancedCurrencies,
      actionItems: result.unmatchedSettlements.concat(result.stuckPayments)
    }
  });
}));

router.get('/workspaces/:workspaceId/agent/collections', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const result = await agenticFinanceEngine.runCollectionsAgent({ workspaceId });
  res.json({ collections: jsonSafe(result) });
}));

router.get('/workspaces/:workspaceId/agent/treasury', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const result = await agenticFinanceEngine.runTreasuryAgent({ workspaceId });
  res.json({ treasury: jsonSafe(result) });
}));

router.get('/workspaces/:workspaceId/agent/expense-audit', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const result = await agenticFinanceEngine.runExpenseAgent({ workspaceId });
  res.json({ expenseAudit: jsonSafe(result) });
}));

router.get('/workspaces/:workspaceId/agent/tools', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const tools = agenticFinanceEngine.getToolRegistry();
  res.json({ tools });
}));

router.post('/workspaces/:workspaceId/agent/tools/execute', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const { toolName } = z.object({
    toolName: z.enum(['collect_receivables', 'reconcile_ledger', 'forecast_treasury', 'audit_expenses'])
  }).parse(req.body);

  const workspaceId = req.params.workspaceId;
  const membership = req.membership;

  const tools = agenticFinanceEngine.getToolRegistry();
  const toolDef = tools.find(t => t.name === toolName);
  if (!toolDef.requiredRoles.includes(membership.role)) {
    throw new AppError(`Role "${membership.role}" is not authorized to execute tool "${toolName}". Required: ${toolDef.requiredRoles.join(', ')}.`, 403);
  }

  const execution = await agenticFinanceEngine.executeTool({
    toolName,
    workspaceId,
    actorId: req.user.id
  });

  res.json({ execution: jsonSafe(execution) });
}));

router.get('/workspaces/:workspaceId/dashboard', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const [obligations, settlements, expenses, pendingExpenses, payments, campaigns, reimbursements] = await Promise.all([
    prisma.obligation.findMany({ where: { workspaceId } }),
    prisma.settlement.aggregate({ where: { workspaceId }, _sum: { amountMinor: true } }),
    prisma.expense.aggregate({ where: { workspaceId, status: { in: ['APPROVED', 'PAID'] } }, _sum: { amountMinor: true } }),
    prisma.expense.count({ where: { workspaceId, status: 'SUBMITTED' } }),
    prisma.payment.count({ where: { workspaceId, status: 'PENDING' } }),
    prisma.campaign.count({ where: { workspaceId, status: 'ACTIVE' } }),
    prisma.reimbursement.count({ where: { workspaceId, status: 'PENDING' } })
  ]);
  const expected = obligations.reduce((sum, o) => sum + o.amountMinor, 0n);
  const received = settlements._sum.amountMinor || 0n;
  res.json({
    summary: {
      obligationsMinor: expected.toString(),
      receivedMinor: received.toString(),
      approvedExpensesMinor: (expenses._sum.amountMinor || 0n).toString(),
      outstandingMinor: (expected - received).toString(),
      pendingExpenses,
      pendingPayments: payments,
      activeCampaigns: campaigns,
      pendingReimbursements: reimbursements,
      obligationCount: obligations.length
    }
  });
}));

export default router;
