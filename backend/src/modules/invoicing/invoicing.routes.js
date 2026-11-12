import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import {
  parseMinorUnits,
  jsonSafe,
  parseQuantityScaled,
  multiplyPriceByQuantity,
  calculateTaxMinor
} from '../../shared/money.js';

export const invoicingRouter = Router();

invoicingRouter.use(authenticate);

// -------------------------------------------------------------
// Customers
// -------------------------------------------------------------
invoicingRouter.get('/workspaces/:workspaceId/customers', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { invoices: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ customers: jsonSafe(customers) });
}));

invoicingRouter.post('/workspaces/:workspaceId/customers', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email(),
    phone: z.string().optional(),
    taxId: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional()
  }).parse(req.body);

  const existing = await prisma.customer.findUnique({
    where: { workspaceId_email: { workspaceId: req.params.workspaceId, email: data.email } }
  });
  if (existing) throw new AppError('A customer with this email already exists in this workspace.', 409);

  const customer = await prisma.customer.create({
    data: {
      workspaceId: req.params.workspaceId,
      ...data
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: req.params.workspaceId,
      actorId: req.user.id,
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      details: { name: customer.name, email: customer.email }
    }
  });

  res.status(201).json({ customer: jsonSafe(customer) });
}));

// -------------------------------------------------------------
// Invoices
// -------------------------------------------------------------
invoicingRouter.get('/workspaces/:workspaceId/invoices', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: {
      customer: true,
      lines: true,
      settlements: true,
      allocations: { include: { payment: true } },
      creditNotes: { include: { lines: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ invoices: jsonSafe(invoices) });
}));

invoicingRouter.get('/invoices/:id', asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      lines: true,
      settlements: true,
      allocations: { include: { payment: true } },
      creditNotes: { include: { lines: true } },
      workspace: true
    }
  });
  if (!invoice) throw new AppError('Invoice not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: invoice.workspaceId } }
  });
  if (!membership) throw new AppError('Access denied.', 403);

  res.json({ invoice: jsonSafe(invoice) });
}));

invoicingRouter.post('/workspaces/:workspaceId/invoices', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const data = z.object({
    customerId: z.string(),
    invoiceNumber: z.string().trim().min(3).max(40),
    dueDate: z.string().datetime(),
    notes: z.string().optional(),
    lines: z.array(z.object({
      description: z.string().trim().min(2),
      quantity: z.number().positive().default(1),
      unitPrice: z.union([z.string(), z.number()])
    })).min(1, 'At least one line item is required.')
  }).parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
  if (!customer || customer.workspaceId !== workspace.id) {
    throw new AppError('Customer not found in this workspace.', 404);
  }

  // Calculate totals using exact scaled integer arithmetic
  let subtotalMinor = 0n;
  const processedLines = data.lines.map(l => {
    const unitPriceMinor = parseMinorUnits(l.unitPrice, workspace.currency);
    const { scaled } = parseQuantityScaled(l.quantity);
    const amountMinor = multiplyPriceByQuantity(unitPriceMinor, scaled);
    subtotalMinor += amountMinor;
    return {
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor,
      amountMinor
    };
  });

  // Calculate tax in minor units using basis points (1600 bps = 16.00% VAT in KE, 1500 bps = 15.00% in ZA)
  const taxRateBps = workspace.vatRate
    ? Math.round(Number(workspace.vatRate) * 10000)
    : (workspace.country === 'ZA' ? 1500 : 1600);
  const taxMinor = calculateTaxMinor(subtotalMinor, taxRateBps);
  const totalMinor = subtotalMinor + taxMinor;

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        workspaceId: workspace.id,
        customerId: customer.id,
        invoiceNumber: data.invoiceNumber,
        dueDate: new Date(data.dueDate),
        currency: workspace.currency,
        subtotalMinor,
        taxMinor,
        totalMinor,
        paidMinor: 0n,
        status: 'SENT',
        notes: data.notes,
        lines: {
          create: processedLines
        }
      },
      include: { lines: true, customer: true }
    });

    // Create tracking obligation linked to invoice
    const obligation = await tx.obligation.create({
      data: {
        workspaceId: workspace.id,
        invoiceId: invoice.id,
        title: `Invoice ${invoice.invoiceNumber} - ${customer.name}`,
        memberName: customer.name,
        memberEmail: customer.email,
        amountMinor: totalMinor,
        currency: workspace.currency,
        dueAt: invoice.dueDate,
        status: 'OPEN'
      }
    });

    // Post GAAP accrual journal: Debit Accounts Receivable (1200), Credit Revenue (4000)
    await tx.journalEntry.create({
      data: {
        workspaceId: workspace.id,
        reference: `INV-POST-${invoice.id.slice(-8)}-${Date.now()}`,
        description: `Commercial Invoice issued to ${customer.name} (${invoice.invoiceNumber})`,
        lines: {
          create: [
            { accountCode: '1200-ACCOUNTS-RECEIVABLE', side: 'DEBIT', amountMinor: totalMinor, currency: workspace.currency },
            { accountCode: '4000-REVENUE', side: 'CREDIT', amountMinor: totalMinor, currency: workspace.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorId: req.user.id,
        action: 'INVOICE_ISSUED',
        entityType: 'Invoice',
        entityId: invoice.id,
        details: { invoiceNumber: invoice.invoiceNumber, totalMinor: totalMinor.toString(), obligationId: obligation.id }
      }
    });

    return invoice;
  });

  res.status(201).json({ invoice: jsonSafe(result) });
}));

// -------------------------------------------------------------
// Settle / Allocate Payment to Invoice (Full or Partial)
// -------------------------------------------------------------
invoicingRouter.post('/invoices/:id/settle', asyncHandler(async (req, res) => {
  const { paymentRef, rail = 'DEVELOPMENT', amount } = req.body;
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { workspace: true, customer: true, obligations: true }
  });
  if (!invoice) throw new AppError('Invoice not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: invoice.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Only finance managers can mark invoices as settled.', 403);
  }

  const alreadyPaid = invoice.paidMinor || 0n;
  const remainingMinor = invoice.totalMinor - alreadyPaid;
  if (remainingMinor <= 0n) {
    throw new AppError('Invoice is already fully settled.', 400);
  }

  const paymentAmountMinor = amount
    ? parseMinorUnits(amount, invoice.currency)
    : remainingMinor;

  if (paymentAmountMinor <= 0n) {
    throw new AppError('Payment amount must be greater than zero.', 400);
  }

  if (paymentAmountMinor > remainingMinor) {
    throw new AppError(
      `Payment amount exceeds remaining invoice balance. Remaining: ${remainingMinor} minor units, attempted: ${paymentAmountMinor}.`,
      400
    );
  }

  const cleanRef = (paymentRef || `SETTLE-INV-${invoice.invoiceNumber}-${Date.now().toString(36)}`).toUpperCase();

  const updated = await prisma.$transaction(async (tx) => {
    const newPaidMinor = alreadyPaid + paymentAmountMinor;
    const newStatus = newPaidMinor >= invoice.totalMinor ? 'PAID' : 'PARTIALLY_PAID';

    const inv = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidMinor: newPaidMinor,
        status: newStatus
      }
    });

    // Create payment & settlement record
    const payment = await tx.payment.create({
      data: {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice.id,
        rail: rail === 'MPESA' ? 'MPESA' : rail === 'STELLAR' ? 'STELLAR' : rail === 'PAYSHAP_EFT' ? 'PAYSHAP_EFT' : 'DEVELOPMENT',
        status: 'CONFIRMED',
        amountMinor: paymentAmountMinor,
        currency: invoice.currency,
        providerRef: cleanRef,
        idempotencyKey: `INV-SETTLE-${invoice.id}-${Date.now()}`
      }
    });

    const settlement = await tx.settlement.create({
      data: {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        amountMinor: paymentAmountMinor,
        currency: invoice.currency,
        rail: payment.rail,
        externalRef: cleanRef
      }
    });

    // Create durable InvoiceAllocation record
    await tx.invoiceAllocation.create({
      data: {
        invoiceId: invoice.id,
        paymentId: payment.id,
        settlementId: settlement.id,
        amountMinor: paymentAmountMinor,
        notes: `Allocated by user ${req.user.id}`
      }
    });

    // Settle linked obligation if fully paid, or update status
    if (invoice.obligations[0]) {
      await tx.obligation.update({
        where: { id: invoice.obligations[0].id },
        data: { status: newStatus === 'PAID' ? 'SETTLED' : 'PARTIALLY_PAID' }
      });
    }

    // Post GAAP cash receipt journal entry: Debit Cash/Bank (1000/1030), Credit Accounts Receivable (1200)
    const cashAccount = invoice.workspace.country === 'ZA' ? '1030-BANK-CLEARING' : '1000-CASH-CLEARING';
    await tx.journalEntry.create({
      data: {
        workspaceId: invoice.workspaceId,
        reference: `INV-RECEIPT-${invoice.id.slice(-8)}-${Date.now()}`,
        description: `Settlement received for invoice ${invoice.invoiceNumber} from ${invoice.customer.name}`,
        lines: {
          create: [
            { accountCode: cashAccount, side: 'DEBIT', amountMinor: paymentAmountMinor, currency: invoice.currency },
            { accountCode: '1200-ACCOUNTS-RECEIVABLE', side: 'CREDIT', amountMinor: paymentAmountMinor, currency: invoice.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: invoice.workspaceId,
        actorId: req.user.id,
        action: newStatus === 'PAID' ? 'INVOICE_SETTLED' : 'INVOICE_PARTIALLY_SETTLED',
        entityType: 'Invoice',
        entityId: invoice.id,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          allocatedMinor: paymentAmountMinor.toString(),
          totalPaidMinor: newPaidMinor.toString(),
          status: newStatus,
          paymentRef: cleanRef
        }
      }
    });

    return inv;
  });

  res.json({
    invoice: jsonSafe(updated),
    notice: updated.status === 'PAID'
      ? 'Invoice fully settled and posted to Accounts Receivable ledger.'
      : 'Partial payment allocated to invoice and posted to Accounts Receivable ledger.'
  });
}));

// -------------------------------------------------------------
// Allocate Existing Verified Payment to Invoice
// -------------------------------------------------------------
invoicingRouter.post('/invoices/:id/allocate-payment', asyncHandler(async (req, res) => {
  const { paymentId, amount } = z.object({
    paymentId: z.string(),
    amount: z.union([z.string(), z.number()]).optional()
  }).parse(req.body);

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { workspace: true, customer: true, obligations: true }
  });
  if (!invoice) throw new AppError('Invoice not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: invoice.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Only finance managers can allocate payments to invoices.', 403);
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.workspaceId !== invoice.workspaceId) {
    throw new AppError('Payment not found in this workspace.', 404);
  }
  if (payment.status !== 'CONFIRMED') {
    throw new AppError('Only verified and confirmed payments can be allocated to invoices.', 400);
  }

  const alreadyPaid = invoice.paidMinor || 0n;
  const remainingMinor = invoice.totalMinor - alreadyPaid;
  if (remainingMinor <= 0n) {
    throw new AppError('Invoice is already fully settled.', 400);
  }

  const allocateMinor = amount
    ? parseMinorUnits(amount, invoice.currency)
    : (payment.amountMinor < remainingMinor ? payment.amountMinor : remainingMinor);

  if (allocateMinor > remainingMinor) {
    throw new AppError(`Allocation amount exceeds remaining invoice balance (${remainingMinor} minor units).`, 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const newPaidMinor = alreadyPaid + allocateMinor;
    const newStatus = newPaidMinor >= invoice.totalMinor ? 'PAID' : 'PARTIALLY_PAID';

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidMinor: newPaidMinor,
        status: newStatus
      }
    });

    await tx.invoiceAllocation.create({
      data: {
        invoiceId: invoice.id,
        paymentId: payment.id,
        amountMinor: allocateMinor,
        notes: `Allocated by user ${req.user.id}`
      }
    });

    const cashAccount = invoice.workspace.country === 'ZA' ? '1030-BANK-CLEARING' : '1000-CASH-CLEARING';
    await tx.journalEntry.create({
      data: {
        workspaceId: invoice.workspaceId,
        reference: `INV-ALLOC-${invoice.id.slice(-8)}-${Date.now()}`,
        description: `Payment allocation for invoice ${invoice.invoiceNumber}`,
        lines: {
          create: [
            { accountCode: cashAccount, side: 'DEBIT', amountMinor: allocateMinor, currency: invoice.currency },
            { accountCode: '1200-ACCOUNTS-RECEIVABLE', side: 'CREDIT', amountMinor: allocateMinor, currency: invoice.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: invoice.workspaceId,
        actorId: req.user.id,
        action: 'INVOICE_PAYMENT_ALLOCATED',
        entityType: 'Invoice',
        entityId: invoice.id,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          paymentId: payment.id,
          amountMinor: allocateMinor.toString(),
          totalPaidMinor: newPaidMinor.toString(),
          status: newStatus
        }
      }
    });

    return updated;
  });

  res.json({ invoice: jsonSafe(result), notice: 'Payment successfully allocated to invoice.' });
}));

// -------------------------------------------------------------
// Credit Notes
// -------------------------------------------------------------
invoicingRouter.post('/workspaces/:workspaceId/invoices/:id/credit-notes', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const data = z.object({
    reason: z.string().trim().min(3),
    lines: z.array(z.object({
      description: z.string().trim().min(2),
      quantity: z.number().positive().default(1),
      unitPrice: z.union([z.string(), z.number()])
    })).min(1, 'At least one credit note line item is required.')
  }).parse(req.body);

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { customer: true, workspace: true }
  });
  if (!invoice || invoice.workspaceId !== req.params.workspaceId) {
    throw new AppError('Invoice not found in this workspace.', 404);
  }

  let subtotalCreditMinor = 0n;
  const processedLines = data.lines.map(l => {
    const unitPriceMinor = parseMinorUnits(l.unitPrice, invoice.currency);
    const { scaled } = parseQuantityScaled(l.quantity);
    const amountMinor = multiplyPriceByQuantity(unitPriceMinor, scaled);
    subtotalCreditMinor += amountMinor;
    return {
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor,
      amountMinor
    };
  });

  const taxRateBps = invoice.workspace.vatRate
    ? Math.round(Number(invoice.workspace.vatRate) * 10000)
    : (invoice.workspace.country === 'ZA' ? 1500 : 1600);
  const taxCreditMinor = calculateTaxMinor(subtotalCreditMinor, taxRateBps);
  const totalCreditMinor = subtotalCreditMinor + taxCreditMinor;

  const outstandingBalance = invoice.totalMinor - (invoice.paidMinor || 0n);
  if (totalCreditMinor > outstandingBalance) {
    throw new AppError(
      `Credit note total (${totalCreditMinor} minor units) cannot exceed outstanding invoice balance (${outstandingBalance} minor units).`,
      400
    );
  }

  const creditNoteNumber = `CN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

  const result = await prisma.$transaction(async (tx) => {
    const creditNote = await tx.creditNote.create({
      data: {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice.id,
        creditNoteNumber,
        currency: invoice.currency,
        subtotalMinor: subtotalCreditMinor,
        taxMinor: taxCreditMinor,
        totalMinor: totalCreditMinor,
        reason: data.reason,
        status: 'ISSUED',
        lines: {
          create: processedLines.map(l => ({
            description: l.description,
            amountMinor: l.amountMinor
          }))
        }
      },
      include: { lines: true, invoice: { include: { customer: true } } }
    });

    // Update invoice balance and status
    const newPaidMinor = (invoice.paidMinor || 0n) + totalCreditMinor;
    const newStatus = newPaidMinor >= invoice.totalMinor ? 'PAID' : 'PARTIALLY_PAID';
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidMinor: newPaidMinor,
        status: newStatus
      }
    });

    // Reverse Accounts Receivable and Revenue via GAAP journal entry
    await tx.journalEntry.create({
      data: {
        workspaceId: invoice.workspaceId,
        reference: `CN-${creditNote.id.slice(-8)}-${Date.now()}`,
        description: `Credit Note ${creditNote.creditNoteNumber} issued for Invoice ${invoice.invoiceNumber}: ${data.reason}`,
        lines: {
          create: [
            { accountCode: '4000-REVENUE', side: 'DEBIT', amountMinor: totalCreditMinor, currency: invoice.currency },
            { accountCode: '1200-ACCOUNTS-RECEIVABLE', side: 'CREDIT', amountMinor: totalCreditMinor, currency: invoice.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: invoice.workspaceId,
        actorId: req.user.id,
        action: 'CREDIT_NOTE_ISSUED',
        entityType: 'CreditNote',
        entityId: creditNote.id,
        details: {
          creditNoteNumber: creditNote.creditNoteNumber,
          invoiceId: invoice.id,
          totalCreditMinor: totalCreditMinor.toString(),
          reason: data.reason
        }
      }
    });

    return creditNote;
  });

  res.status(201).json({ creditNote: jsonSafe(result) });
}));

invoicingRouter.get('/workspaces/:workspaceId/credit-notes', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const creditNotes = await prisma.creditNote.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { lines: true, invoice: { include: { customer: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ creditNotes: jsonSafe(creditNotes) });
}));

invoicingRouter.get('/credit-notes/:id', asyncHandler(async (req, res) => {
  const creditNote = await prisma.creditNote.findUnique({
    where: { id: req.params.id },
    include: { lines: true, invoice: { include: { customer: true } }, workspace: true }
  });
  if (!creditNote) throw new AppError('Credit note not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: creditNote.workspaceId } }
  });
  if (!membership) throw new AppError('Access denied.', 403);

  res.json({ creditNote: jsonSafe(creditNote) });
}));
