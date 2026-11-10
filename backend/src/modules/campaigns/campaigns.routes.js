import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { parseMinorUnits, jsonSafe } from '../../shared/money.js';

const router = Router();
router.use(authenticate);

// List workspace campaigns
router.get('/workspaces/:workspaceId/campaigns', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: {
      obligations: {
        include: { settlements: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const enriched = campaigns.map(c => {
    let collectedMinor = 0n;
    let expectedMinor = 0n;
    for (const ob of c.obligations) {
      expectedMinor += ob.amountMinor;
      for (const s of ob.settlements) {
        collectedMinor += s.amountMinor;
      }
    }
    const targetMinor = c.targetAmountMinor;
    const progressPercent = targetMinor > 0n ? Number((collectedMinor * 100n) / targetMinor) : 0;

    return {
      ...c,
      targetAmountMinor: c.targetAmountMinor.toString(),
      collectedMinor: collectedMinor.toString(),
      expectedMinor: expectedMinor.toString(),
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
      obligationsCount: c.obligations.length
    };
  });

  res.json({ campaigns: jsonSafe(enriched) });
}));

// Create a campaign
router.post('/workspaces/:workspaceId/campaigns', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const data = z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().max(1000).optional(),
    targetAmount: z.union([z.string(), z.number()]),
    deadline: z.string().datetime().optional()
  }).parse(req.body);

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      title: data.title,
      description: data.description,
      targetAmountMinor: parseMinorUnits(data.targetAmount),
      currency: workspace.currency,
      deadline: data.deadline ? new Date(data.deadline) : null
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: req.user.id,
      action: 'CAMPAIGN_CREATED',
      entityType: 'Campaign',
      entityId: campaign.id
    }
  });

  res.status(201).json({ campaign: jsonSafe(campaign) });
}));

// Add obligations to a campaign
router.post('/campaigns/:id/obligations', asyncHandler(async (req, res) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
  if (!campaign) throw new AppError('Campaign not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: campaign.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Permission required to manage campaign obligations.', 403);
  }

  const data = z.object({
    memberName: z.string().trim().min(2).max(100),
    memberEmail: z.string().email().optional(),
    amount: z.union([z.string(), z.number()]),
    dueAt: z.string().datetime().optional()
  }).parse(req.body);

  const obligation = await prisma.obligation.create({
    data: {
      workspaceId: campaign.workspaceId,
      campaignId: campaign.id,
      title: `${campaign.title} - ${data.memberName}`,
      description: `Campaign contribution towards ${campaign.title}`,
      memberName: data.memberName,
      memberEmail: data.memberEmail,
      amountMinor: parseMinorUnits(data.amount),
      currency: campaign.currency,
      dueAt: data.dueAt ? new Date(data.dueAt) : campaign.deadline
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: campaign.workspaceId,
      actorId: req.user.id,
      action: 'CAMPAIGN_OBLIGATION_ADDED',
      entityType: 'Obligation',
      entityId: obligation.id
    }
  });

  res.status(201).json({ obligation: jsonSafe(obligation) });
}));

export default router;
