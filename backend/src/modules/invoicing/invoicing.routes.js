import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { parseMinorUnits, jsonSafe } from '../../shared/money.js';

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
    include: { customer: true, lines: true, settlements: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ invoices: jsonSafe(invoices) });
}));

invoicingRouter.get('/invoices/:id', asyncHandler(async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { customer: true, lines: true, settlements: true, workspace: true }
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

  // Calculate totals
  let subtotalMinor = 0n;
  const processedLines = data.lines.map(l => {
    const unitPriceMinor = parseMinorUnits(l.unitPrice, workspace.currency);
    const amountMinor = unitPriceMinor * BigInt(Math.round(l.quantity));
    subtotalMinor += amountMinor;
    return {
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor,
      amountMinor
    };
  });

  const vatRate = workspace.vatRate ? Number(workspace.vatRate) : (workspace.country === 'ZA' ? 0.15 : 0.16);
  const taxMinor = BigInt(Math.round(Number(subtotalMinor) * vatRate));
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

// Settle invoice
invoicingRouter.post('/invoices/:id/settle', asyncHandler(async (req, res) => {
  const { paymentRef, rail = 'DEVELOPMENT' } = req.body;
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

  const cleanRef = (paymentRef || `SETTLE-INV-${invoice.invoiceNumber}`).toUpperCase();

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID' }
    });

    // Create payment & settlement
    const payment = await tx.payment.create({
      data: {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice.id,
        rail: rail === 'MPESA' ? 'MPESA' : rail === 'STELLAR' ? 'STELLAR' : rail === 'PAYSHAP_EFT' ? 'PAYSHAP_EFT' : 'DEVELOPMENT',
        status: 'CONFIRMED',
        amountMinor: invoice.totalMinor,
        currency: invoice.currency,
        providerRef: cleanRef,
        idempotencyKey: `INV-SETTLE-${invoice.id}-${Date.now()}`
      }
    });

    await tx.settlement.create({
      data: {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        amountMinor: invoice.totalMinor,
        currency: invoice.currency,
        rail: payment.rail,
        externalRef: cleanRef
      }
    });

    // Settle linked obligation
    if (invoice.obligations[0]) {
      await tx.obligation.update({
        where: { id: invoice.obligations[0].id },
        data: { status: 'SETTLED' }
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
            { accountCode: cashAccount, side: 'DEBIT', amountMinor: invoice.totalMinor, currency: invoice.currency },
            { accountCode: '1200-ACCOUNTS-RECEIVABLE', side: 'CREDIT', amountMinor: invoice.totalMinor, currency: invoice.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: invoice.workspaceId,
        actorId: req.user.id,
        action: 'INVOICE_SETTLED',
        entityType: 'Invoice',
        entityId: invoice.id,
        details: { invoiceNumber: invoice.invoiceNumber, paymentRef: cleanRef }
      }
    });

    return inv;
  });

  res.json({ invoice: jsonSafe(updated), notice: 'Invoice settled and posted to Accounts Receivable ledger.' });
}));
