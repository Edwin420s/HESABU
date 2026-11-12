import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { parseMinorUnits, jsonSafe } from '../../shared/money.js';
import { postingService } from '../finance/postingService.js';

export const billsRouter = Router();

billsRouter.use(authenticate);

// -------------------------------------------------------------
// Suppliers
// -------------------------------------------------------------
billsRouter.get('/workspaces/:workspaceId/suppliers', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const suppliers = await prisma.supplier.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { bills: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ suppliers: jsonSafe(suppliers) });
}));

billsRouter.post('/workspaces/:workspaceId/suppliers', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email(),
    phone: z.string().optional(),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    taxId: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional()
  }).parse(req.body);

  const existing = await prisma.supplier.findUnique({
    where: { workspaceId_email: { workspaceId: req.params.workspaceId, email: data.email } }
  });
  if (existing) throw new AppError('A supplier with this email already exists in this workspace.', 409);

  const supplier = await prisma.supplier.create({
    data: {
      workspaceId: req.params.workspaceId,
      ...data
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: req.params.workspaceId,
      actorId: req.user.id,
      action: 'SUPPLIER_CREATED',
      entityType: 'Supplier',
      entityId: supplier.id,
      details: { name: supplier.name, email: supplier.email }
    }
  });

  res.status(201).json({ supplier: jsonSafe(supplier) });
}));

// -------------------------------------------------------------
// Supplier Bills (Accounts Payable)
// -------------------------------------------------------------
billsRouter.get('/workspaces/:workspaceId/bills', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const bills = await prisma.supplierBill.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { supplier: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ bills: jsonSafe(bills) });
}));

billsRouter.post('/workspaces/:workspaceId/bills', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const data = z.object({
    supplierId: z.string(),
    billNumber: z.string().trim().min(2).max(40),
    dueDate: z.string().datetime(),
    amount: z.union([z.string(), z.number()]),
    category: z.string().default('OPERATING'),
    receiptUrl: z.string().url().optional().or(z.literal('')),
    notes: z.string().optional()
  }).parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier || supplier.workspaceId !== workspace.id) {
    throw new AppError('Supplier not found in this workspace.', 404);
  }

  const amountMinor = parseMinorUnits(data.amount, workspace.currency);

  const bill = await prisma.supplierBill.create({
    data: {
      workspaceId: workspace.id,
      supplierId: supplier.id,
      billNumber: data.billNumber,
      dueDate: new Date(data.dueDate),
      currency: workspace.currency,
      amountMinor,
      category: data.category.toUpperCase(),
      receiptUrl: data.receiptUrl || null,
      notes: data.notes,
      status: 'PENDING_APPROVAL'
    },
    include: { supplier: true }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: req.user.id,
      action: 'SUPPLIER_BILL_SUBMITTED',
      entityType: 'SupplierBill',
      entityId: bill.id,
      details: { billNumber: bill.billNumber, amountMinor: amountMinor.toString() }
    }
  });

  res.status(201).json({ bill: jsonSafe(bill) });
}));

billsRouter.post('/bills/:id/approve', asyncHandler(async (req, res) => {
  const bill = await prisma.supplierBill.findUnique({
    where: { id: req.params.id },
    include: { workspace: true, supplier: true }
  });
  if (!bill) throw new AppError('Bill not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: bill.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'APPROVER', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('You lack permissions to approve supplier payables.', 403);
  }

  if (bill.status !== 'PENDING_APPROVAL') {
    throw new AppError(`Cannot approve bill in status ${bill.status}.`, 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const approved = await tx.supplierBill.update({
      where: { id: bill.id },
      data: {
        status: 'APPROVED',
        approvedById: req.user.id
      }
    });

    // Post GAAP bill recognition via authoritative PostingService: Debit Expense (5000), Credit Accounts Payable (2000)
    await postingService.postEntry({
      workspaceId: bill.workspaceId,
      reference: `BILL-ACCRUAL-${bill.id.slice(-8)}-${Date.now()}`,
      description: `Approved supplier payable from ${bill.supplier.name} (${bill.billNumber})`,
      lines: [
        { accountCode: '5000-OPERATING-EXPENSES', side: 'DEBIT', amountMinor: bill.amountMinor, currency: bill.currency },
        { accountCode: '2000-ACCOUNTS-PAYABLE', side: 'CREDIT', amountMinor: bill.amountMinor, currency: bill.currency }
      ],
      actorId: req.user.id,
      tx
    });

    await tx.auditLog.create({
      data: {
        workspaceId: bill.workspaceId,
        actorId: req.user.id,
        action: 'SUPPLIER_BILL_APPROVED',
        entityType: 'SupplierBill',
        entityId: bill.id,
        details: { billNumber: bill.billNumber, approverId: req.user.id }
      }
    });

    return approved;
  });

  res.json({ bill: jsonSafe(updated) });
}));

billsRouter.post('/bills/:id/pay', asyncHandler(async (req, res) => {
  const { paymentRef, rail = 'PAYSHAP_EFT' } = req.body;
  const bill = await prisma.supplierBill.findUnique({
    where: { id: req.params.id },
    include: { workspace: true, supplier: true }
  });
  if (!bill) throw new AppError('Bill not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: bill.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Only finance managers can disburse supplier payments.', 403);
  }

  if (bill.status !== 'APPROVED') {
    throw new AppError('Bill must be approved prior to payment disbursement.', 400);
  }

  const cleanRef = (paymentRef || `PAY-BILL-${bill.billNumber}`).toUpperCase();

  const updated = await prisma.$transaction(async (tx) => {
    const paidBill = await tx.supplierBill.update({
      where: { id: bill.id },
      data: { status: 'PAID' }
    });

    const cashAccount = bill.workspace.country === 'ZA' ? '1030-BANK-CLEARING' : '1000-CASH-CLEARING';

    // Post GAAP payment journal via authoritative PostingService: Debit Accounts Payable (2000), Credit Cash/Bank (1000/1030)
    await postingService.postEntry({
      workspaceId: bill.workspaceId,
      reference: `BILL-PAY-${bill.id.slice(-8)}-${Date.now()}`,
      description: `Disbursed supplier payment to ${bill.supplier.name} via ${rail} (${cleanRef})`,
      lines: [
        { accountCode: '2000-ACCOUNTS-PAYABLE', side: 'DEBIT', amountMinor: bill.amountMinor, currency: bill.currency },
        { accountCode: cashAccount, side: 'CREDIT', amountMinor: bill.amountMinor, currency: bill.currency }
      ],
      actorId: req.user.id,
      tx
    });

    await tx.auditLog.create({
      data: {
        workspaceId: bill.workspaceId,
        actorId: req.user.id,
        action: 'SUPPLIER_BILL_PAID',
        entityType: 'SupplierBill',
        entityId: bill.id,
        details: { billNumber: bill.billNumber, paymentRef: cleanRef, rail }
      }
    });

    return paidBill;
  });

  res.json({ bill: jsonSafe(updated), notice: 'Supplier bill disbursed and posted to Accounts Payable ledger.' });
}));
