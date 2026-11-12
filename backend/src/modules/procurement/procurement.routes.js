import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { parseMinorUnits, jsonSafe } from '../../shared/money.js';

export const procurementRouter = Router();

procurementRouter.use(authenticate);

// List purchase requests
procurementRouter.get('/workspaces/:workspaceId/purchase-requests', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const requests = await prisma.purchaseRequest.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ requests: jsonSafe(requests) });
}));

// Submit purchase request
procurementRouter.post('/workspaces/:workspaceId/purchase-requests', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const data = z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().max(1000).optional(),
    amount: z.union([z.string(), z.number()]),
    department: z.string().default('GENERAL')
  }).parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const amountMinor = parseMinorUnits(data.amount, workspace.currency);

  const request = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestedById: req.user.id,
      title: data.title,
      description: data.description,
      amountMinor,
      currency: workspace.currency,
      department: data.department.toUpperCase(),
      status: 'PENDING'
    },
    include: { requestedBy: { select: { id: true, name: true, email: true } } }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: req.user.id,
      action: 'PURCHASE_REQUEST_SUBMITTED',
      entityType: 'PurchaseRequest',
      entityId: request.id,
      details: { title: request.title, amountMinor: amountMinor.toString() }
    }
  });

  res.status(201).json({ request: jsonSafe(request) });
}));

// Review purchase request (Approve / Reject)
procurementRouter.post('/purchase-requests/:id/review', asyncHandler(async (req, res) => {
  const data = z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().optional()
  }).parse(req.body);

  const request = await prisma.purchaseRequest.findUnique({
    where: { id: req.params.id },
    include: { workspace: true }
  });
  if (!request) throw new AppError('Purchase request not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: request.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'APPROVER', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Only approvers or admins can review procurement requests.', 403);
  }

  // Segregation of duties: requester cannot approve their own purchase request
  if (request.requestedById === req.user.id && membership.role !== 'OWNER') {
    throw new AppError('Segregation of duties violation: you cannot approve your own purchase request.', 403);
  }

  // Spending threshold check
  if (data.decision === 'APPROVED' && request.workspace.spendingThresholdMinor) {
    if (request.amountMinor > request.workspace.spendingThresholdMinor && !['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new AppError('This procurement request exceeds your approval spending limit.', 403);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.purchaseRequest.update({
      where: { id: request.id },
      data: {
        status: data.decision,
        approvedById: req.user.id
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId: request.workspaceId,
        actorId: req.user.id,
        action: `PURCHASE_REQUEST_${data.decision}`,
        entityType: 'PurchaseRequest',
        entityId: request.id,
        details: { decision: data.decision, note: data.note }
      }
    });

    return r;
  });

  res.json({ request: jsonSafe(updated) });
}));
