import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { parseMinorUnits, jsonSafe } from '../../shared/money.js';

const router = Router();
router.use(authenticate);

// List reimbursements
router.get('/workspaces/:workspaceId/reimbursements', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const reimbursements = await prisma.reimbursement.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { expense: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ reimbursements: jsonSafe(reimbursements) });
}));

// Submit a reimbursement claim
router.post('/workspaces/:workspaceId/reimbursements', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const data = z.object({
    expenseId: z.string().optional(),
    claimantName: z.string().trim().min(2).max(100),
    amount: z.union([z.string(), z.number()]),
    notes: z.string().max(500).optional()
  }).parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const reimbursement = await prisma.reimbursement.create({
    data: {
      workspaceId: workspace.id,
      expenseId: data.expenseId,
      claimantId: req.user.id,
      claimantName: data.claimantName,
      amountMinor: parseMinorUnits(data.amount),
      currency: workspace.currency,
      notes: data.notes
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: req.user.id,
      action: 'REIMBURSEMENT_CLAIMED',
      entityType: 'Reimbursement',
      entityId: reimbursement.id
    }
  });

  res.status(201).json({ reimbursement: jsonSafe(reimbursement) });
}));

// Approve reimbursement
router.post('/reimbursements/:id/approve', asyncHandler(async (req, res) => {
  const item = await prisma.reimbursement.findUnique({ where: { id: req.params.id } });
  if (!item) throw new AppError('Reimbursement claim not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: item.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER', 'APPROVER'].includes(membership.role)) {
    throw new AppError('Approval permission required.', 403);
  }
  if (item.claimantId === req.user.id && membership.role !== 'OWNER') {
    throw new AppError('Separation of duties: you cannot approve your own reimbursement.', 403);
  }

  const updated = await prisma.reimbursement.update({
    where: { id: item.id },
    data: { status: 'APPROVED' }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: item.workspaceId,
      actorId: req.user.id,
      action: 'REIMBURSEMENT_APPROVED',
      entityType: 'Reimbursement',
      entityId: item.id
    }
  });

  res.json({ reimbursement: jsonSafe(updated) });
}));

// Execute payout and post to double-entry ledger
router.post('/reimbursements/:id/pay', asyncHandler(async (req, res) => {
  const data = z.object({
    paymentRef: z.string().trim().min(3).max(60).optional()
  }).parse(req.body);

  const item = await prisma.reimbursement.findUnique({ where: { id: req.params.id } });
  if (!item) throw new AppError('Reimbursement claim not found.', 404);
  if (item.status !== 'APPROVED') throw new AppError('Claim must be approved before payout.', 400);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: item.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Finance permission required for payout.', 403);
  }

  const result = await prisma.$transaction(async tx => {
    const ref = data.paymentRef || `REIMB-${item.id.slice(0, 8)}`;
    const updated = await tx.reimbursement.update({
      where: { id: item.id },
      data: { status: 'PAID', paymentRef: ref }
    });

    const journal = await tx.journalEntry.create({
      data: {
        workspaceId: item.workspaceId,
        reference: `REIMBURSEMENT-${item.id}`,
        description: `Reimbursement payout to ${item.claimantName} (${ref})`,
        lines: {
          create: [
            { accountCode: '5050-MEMBER-REIMBURSEMENTS', side: 'DEBIT', amountMinor: item.amountMinor, currency: item.currency },
            { accountCode: '1000-CASH-CLEARING', side: 'CREDIT', amountMinor: item.amountMinor, currency: item.currency }
          ]
        }
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: item.workspaceId,
        actorId: req.user.id,
        action: 'REIMBURSEMENT_PAID',
        entityType: 'Reimbursement',
        entityId: item.id,
        details: { journalEntryId: journal.id, paymentRef: ref }
      }
    });

    return updated;
  });

  res.json({ reimbursement: jsonSafe(result), notice: 'Reimbursement settled and posted to ledger.' });
}));

export default router;
