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

const router = Router();

// -------------------------------------------------------------
// Unauthenticated Webhook: Safaricom M-Pesa Callback
// -------------------------------------------------------------
router.post('/payments/mpesa-callback', asyncHandler(async (req, res) => {
  const verified = verifyMpesaCallback({ callbackBody: req.body });
  const payment = await prisma.payment.findFirst({
    where: { providerRef: verified.checkoutRequestId },
    include: { obligation: true }
  });

  if (!payment) {
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  if (payment.status === 'CONFIRMED') {
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Already confirmed' });
  }

  await prisma.$transaction(async tx => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        providerRef: verified.receiptNumber,
        metadata: {
          checkoutRequestId: verified.checkoutRequestId,
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
            { accountCode: '1000-MPESA-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
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
    rail: z.enum(['DEVELOPMENT', 'STELLAR', 'MPESA']),
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
  let providerRef = null;
  let metadata = null;

  if (data.rail === 'MPESA') {
    if (data.phoneNumber) {
      const stk = await initiateMpesaSTKPush({
        phoneNumber: data.phoneNumber,
        amountMinor: outstanding,
        accountReference: obligation.id.slice(0, 12),
        transactionDesc: obligation.title
      });
      providerRef = stk.checkoutRequestId;
      metadata = { phoneNumber: data.phoneNumber, checkoutRequestId: stk.checkoutRequestId };
    }
  } else if (data.rail === 'STELLAR') {
    metadata = {
      memo: `HESABU-${obligation.id.slice(0, 8)}`,
      network: env.STELLAR_NETWORK
    };
  }

  const payment = await prisma.payment.create({
    data: {
      workspaceId: obligation.workspaceId,
      obligationId: obligation.id,
      rail: data.rail,
      amountMinor: outstanding,
      currency: obligation.currency,
      idempotencyKey,
      providerRef,
      metadata
    }
  });

  const notice = data.rail === 'DEVELOPMENT'
    ? 'Development payment attempt registered.'
    : data.rail === 'STELLAR'
    ? 'Stellar payment attempt registered. Awaiting on-chain transaction hash.'
    : 'M-Pesa payment attempt registered. Awaiting callback or carrier confirmation.';

  res.status(201).json({ payment: jsonSafe(payment), notice });
}));

// Development confirmation (strict dev mode check)
router.post('/payments/:id/dev-confirm', asyncHandler(async (req, res) => {
  if (env.PAYMENT_MODE !== 'development') throw new AppError('Development confirmation is disabled in non-development mode.', 403);
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
    expectedMemo: payment.metadata?.memo
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

  res.json({ payment: jsonSafe(result), verification, notice: 'On-chain Stellar transaction independently verified and posted to journal.' });
}));

// M-Pesa manual/carrier confirmation
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
  if (payment.status === 'CONFIRMED') return res.json({ payment: jsonSafe(payment), message: 'Already confirmed via M-Pesa.' });

  const result = await prisma.$transaction(async tx => {
    const existingRef = await tx.settlement.findUnique({ where: { externalRef: cleanReceipt } });
    if (existingRef) throw new AppError(`M-Pesa receipt ${cleanReceipt} has already been registered and settled.`, 409);

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CONFIRMED',
        providerRef: cleanReceipt,
        metadata: { ...(payment.metadata || {}), receiptNumber: cleanReceipt, phoneNumber: data.phoneNumber }
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
          { accountCode: '1000-MPESA-CLEARING', side: 'DEBIT', amountMinor: payment.amountMinor, currency: payment.currency },
          { accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: payment.amountMinor, currency: payment.currency }
        ]}
      }
    });

    await audit(tx, payment.workspaceId, req.user.id, 'PAYMENT_CONFIRMED_MPESA', 'Payment', payment.id, {
      receiptNumber: cleanReceipt,
      journalEntryId: journal.id
    });

    const total = await tx.settlement.aggregate({ where: { obligationId: payment.obligationId }, _sum: { amountMinor: true } });
    const paid = total._sum.amountMinor || 0n;
    const status = paid >= payment.obligation.amountMinor ? 'SETTLED' : 'PARTIALLY_PAID';
    await tx.obligation.update({ where: { id: payment.obligationId }, data: { status } });

    return updated;
  });

  res.json({ payment: jsonSafe(result), receiptNumber: cleanReceipt, notice: 'M-Pesa payment confirmed and posted to ledger.' });
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

// Financial Statements: Trial Balance
router.get('/workspaces/:workspaceId/reports/trial-balance', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const entries = await prisma.journalEntry.findMany({
    where: { workspaceId: req.params.workspaceId, status: 'POSTED' },
    include: { lines: true }
  });

  const accounts = {};
  let grandTotalDebits = 0n;
  let grandTotalCredits = 0n;

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!accounts[line.accountCode]) {
        accounts[line.accountCode] = { accountCode: line.accountCode, debitMinor: 0n, creditMinor: 0n, currency: line.currency };
      }
      if (line.side === 'DEBIT') {
        accounts[line.accountCode].debitMinor += line.amountMinor;
        grandTotalDebits += line.amountMinor;
      } else {
        accounts[line.accountCode].creditMinor += line.amountMinor;
        grandTotalCredits += line.amountMinor;
      }
    }
  }

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
      isBalanced: grandTotalDebits === grandTotalCredits
    }
  });
}));

// Financial Statements: Income Statement (P&L)
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

  const [workspace, obligations, payments, settlements, expenses, campaigns] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.obligation.findMany({ where: { workspaceId }, include: { settlements: true } }),
    prisma.payment.findMany({ where: { workspaceId } }),
    prisma.settlement.findMany({ where: { workspaceId } }),
    prisma.expense.findMany({ where: { workspaceId } }),
    prisma.campaign.findMany({ where: { workspaceId } })
  ]);

  const totalObligations = obligations.reduce((sum, o) => sum + o.amountMinor, 0n);
  const totalSettled = settlements.reduce((sum, s) => sum + s.amountMinor, 0n);
  const totalOutstanding = totalObligations - totalSettled;
  const approvedExpenses = expenses.filter(e => e.status === 'APPROVED' || e.status === 'PAID').reduce((sum, e) => sum + e.amountMinor, 0n);
  const unapprovedExpenses = expenses.filter(e => e.status === 'SUBMITTED');
  const overdue = obligations.filter(o => o.status !== 'SETTLED' && o.dueAt && new Date(o.dueAt) < new Date());

  const q = question.toLowerCase();
  let answer = '';
  let metrics = {};

  if (q.includes('unpaid') || q.includes('owe') || q.includes('outstanding') || q.includes('who has not')) {
    const unpaidMembers = obligations.filter(o => o.status !== 'SETTLED').map(o => `${o.memberName} owes ${Number(o.amountMinor)/100} ${workspace.currency}`);
    answer = unpaidMembers.length > 0
      ? `There are ${unpaidMembers.length} unpaid obligations totaling ${Number(totalOutstanding)/100} ${workspace.currency}:\n• ` + unpaidMembers.join('\n• ')
      : `All obligations in this workspace are completely settled!`;
    metrics = { totalOutstandingMinor: totalOutstanding.toString(), count: unpaidMembers.length };
  } else if (q.includes('spend') || q.includes('expense') || q.includes('cost') || q.includes('burn')) {
    const cats = {};
    for (const e of expenses) {
      cats[e.category] = (cats[e.category] || 0) + Number(e.amountMinor) / 100;
    }
    const catBreakdown = Object.entries(cats).map(([k, v]) => `${k}: ${v} ${workspace.currency}`).join(', ');
    answer = `Total approved expenditures amount to ${Number(approvedExpenses)/100} ${workspace.currency}. Spending breakdown: ${catBreakdown || 'No expenses yet'}. There are ${unapprovedExpenses.length} submissions pending review.`;
    metrics = { approvedExpensesMinor: approvedExpenses.toString(), pendingCount: unapprovedExpenses.length };
  } else if (q.includes('campaign') || q.includes('target') || q.includes('fundrais')) {
    answer = campaigns.length > 0
      ? `There are ${campaigns.length} campaigns active. Details: ` + campaigns.map(c => `"${c.title}" with target ${Number(c.targetAmountMinor)/100} ${c.currency}`).join('; ')
      : 'No active fundraising campaigns currently set up.';
    metrics = { campaignCount: campaigns.length };
  } else if (q.includes('stellar') || q.includes('blockchain') || q.includes('crypto') || q.includes('usdc')) {
    const stellarPayments = payments.filter(p => p.rail === 'STELLAR');
    const confirmedStellar = stellarPayments.filter(p => p.status === 'CONFIRMED');
    answer = `Stellar integration: ${stellarPayments.length} payment attempts initiated, with ${confirmedStellar.length} independently verified on the Stellar Horizon network (${env.STELLAR_NETWORK}).`;
    metrics = { stellarAttempts: stellarPayments.length, confirmed: confirmedStellar.length };
  } else {
    answer = `Financial Summary for ${workspace.name}: Total expected obligations are ${Number(totalObligations)/100} ${workspace.currency}, with ${Number(totalSettled)/100} ${workspace.currency} verified and received. Outstanding balance is ${Number(totalOutstanding)/100} ${workspace.currency}. Total approved spending is ${Number(approvedExpenses)/100} ${workspace.currency}. Net available balance is ${Number(totalSettled - approvedExpenses)/100} ${workspace.currency}.`;
    metrics = {
      totalObligationsMinor: totalObligations.toString(),
      totalSettledMinor: totalSettled.toString(),
      netBalanceMinor: (totalSettled - approvedExpenses).toString()
    };
  }

  res.json({
    response: {
      question,
      answer,
      metrics,
      timestamp: new Date().toISOString()
    }
  });
}));

router.get('/workspaces/:workspaceId/agent/reconcile', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspaceId = req.params.workspaceId;
  const [obligations, payments, settlements, expenses, journalEntries] = await Promise.all([
    prisma.obligation.findMany({ where: { workspaceId }, include: { settlements: true, payments: true } }),
    prisma.payment.findMany({ where: { workspaceId }, include: { obligation: true } }),
    prisma.settlement.findMany({ where: { workspaceId } }),
    prisma.expense.findMany({ where: { workspaceId } }),
    prisma.journalEntry.findMany({ where: { workspaceId }, include: { lines: true } })
  ]);

  const totalObligations = obligations.reduce((sum, o) => sum + o.amountMinor, 0n);
  const totalSettled = settlements.reduce((sum, s) => sum + s.amountMinor, 0n);
  const totalOutstanding = totalObligations - totalSettled;
  const approvedExpenses = expenses.filter(e => e.status === 'APPROVED' || e.status === 'PAID').reduce((sum, e) => sum + e.amountMinor, 0n);
  const unapprovedExpenses = expenses.filter(e => e.status === 'SUBMITTED');

  let journalUnbalancedCount = 0;
  for (const entry of journalEntries) {
    const debits = entry.lines.filter(l => l.side === 'DEBIT').reduce((s, l) => s + l.amountMinor, 0n);
    const credits = entry.lines.filter(l => l.side === 'CREDIT').reduce((s, l) => s + l.amountMinor, 0n);
    if (debits !== credits) {
      journalUnbalancedCount++;
    }
  }

  const actionItems = [];
  if (journalUnbalancedCount > 0) {
    actionItems.push({
      type: 'LEDGER_IMBALANCE',
      severity: 'CRITICAL',
      message: `${journalUnbalancedCount} journal entries have debit/credit imbalances.`
    });
  }

  const overdueObligations = obligations.filter(o => o.status !== 'SETTLED' && o.dueAt && new Date(o.dueAt) < new Date());
  if (overdueObligations.length > 0) {
    actionItems.push({
      type: 'OVERDUE_OBLIGATIONS',
      severity: 'WARNING',
      message: `${overdueObligations.length} obligations are past their due date.`,
      items: overdueObligations.map(o => ({ id: o.id, title: o.title, member: o.memberName, amount: o.amountMinor.toString() }))
    });
  }

  const stuckPayments = payments.filter(p => p.status === 'PENDING' && (Date.now() - new Date(p.createdAt).getTime()) > 3600000);
  if (stuckPayments.length > 0) {
    actionItems.push({
      type: 'PENDING_PAYMENT_FOLLOWUP',
      severity: 'INFO',
      message: `${stuckPayments.length} payment attempts have been pending verification for over an hour.`,
      items: stuckPayments.map(p => ({ id: p.id, rail: p.rail, amount: p.amountMinor.toString() }))
    });
  }

  if (unapprovedExpenses.length > 0) {
    actionItems.push({
      type: 'UNREVIEWED_EXPENSES',
      severity: 'ACTION_REQUIRED',
      message: `${unapprovedExpenses.length} expense submissions require review.`,
      items: unapprovedExpenses.map(e => ({ id: e.id, title: e.title, amount: e.amountMinor.toString() }))
    });
  }

  res.json({
    insights: {
      generatedAt: new Date().toISOString(),
      agentRole: 'Autonomous Financial Reconciliation & Intelligence Agent',
      totalObligationsMinor: totalObligations.toString(),
      totalSettledMinor: totalSettled.toString(),
      totalOutstandingMinor: totalOutstanding.toString(),
      approvedExpensesMinor: approvedExpenses.toString(),
      journalEntriesCount: journalEntries.length,
      reconciliationHealth: journalUnbalancedCount === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION',
      actionItems
    }
  });
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
