import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { parseMinorUnits, jsonSafe } from '../../shared/money.js';

const router = Router();
router.use(authenticate);

// List recurring schedules
router.get('/workspaces/:workspaceId/recurring', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const schedules = await prisma.recurringSchedule.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ schedules: jsonSafe(schedules) });
}));

// Create a recurring schedule
router.post('/workspaces/:workspaceId/recurring', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), asyncHandler(async (req, res) => {
  const data = z.object({
    title: z.string().trim().min(2).max(120),
    frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY']).optional(),
    interval: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional(),
    amountMinor: z.union([z.string(), z.number(), z.bigint()]).optional(),
    nextRunAt: z.string().datetime().optional()
  }).parse(req.body);

  const freq = (data.frequency || data.interval || 'MONTHLY').toUpperCase();
  const validFreq = ['WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(freq) ? freq : 'MONTHLY';
  const amountMinor = data.amountMinor !== undefined
    ? BigInt(data.amountMinor)
    : parseMinorUnits(data.amount || '0');

  const workspace = await prisma.workspace.findUnique({ where: { id: req.params.workspaceId } });
  const schedule = await prisma.recurringSchedule.create({
    data: {
      workspaceId: workspace.id,
      title: data.title,
      frequency: validFreq,
      amountMinor,
      currency: workspace.currency,
      nextRunAt: data.nextRunAt ? new Date(data.nextRunAt) : new Date(Date.now() + 30 * 86400000)
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: req.user.id,
      action: 'RECURRING_SCHEDULE_CREATED',
      entityType: 'RecurringSchedule',
      entityId: schedule.id
    }
  });

  res.status(201).json({ schedule: jsonSafe(schedule) });
}));

// Trigger recurring schedule: generates obligations for workspace members
router.post('/recurring/:id/trigger', asyncHandler(async (req, res) => {
  const schedule = await prisma.recurringSchedule.findUnique({ where: { id: req.params.id } });
  if (!schedule) throw new AppError('Recurring schedule not found.', 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: req.user.id, workspaceId: schedule.workspaceId } }
  });
  if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
    throw new AppError('Permission required to trigger schedule.', 403);
  }

  // Idempotency check: prevent duplicate triggers within same run interval unless force=true
  const now = new Date();
  if (schedule.lastRunAt && req.query.force !== 'true') {
    const elapsedMs = now.getTime() - new Date(schedule.lastRunAt).getTime();
    const minIntervalMs = schedule.frequency === 'WEEKLY' ? 6 * 86400000 : schedule.frequency === 'MONTHLY' ? 25 * 86400000 : 75 * 86400000;
    if (elapsedMs < minIntervalMs) {
      throw new AppError(
        `Recurring schedule was already triggered on ${new Date(schedule.lastRunAt).toISOString().split('T')[0]}. Next run scheduled for ${new Date(schedule.nextRunAt).toISOString().split('T')[0]}. Set ?force=true to override.`,
        400
      );
    }
  }

  const members = await prisma.membership.findMany({
    where: { workspaceId: schedule.workspaceId },
    include: { user: true }
  });

  const created = [];
  for (const m of members) {
    const ob = await prisma.obligation.create({
      data: {
        workspaceId: schedule.workspaceId,
        title: `${schedule.title} (${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`,
        description: `Generated from recurring ${schedule.frequency.toLowerCase()} schedule: ${schedule.title}`,
        memberName: m.user.name,
        memberEmail: m.user.email,
        amountMinor: schedule.amountMinor,
        currency: schedule.currency,
        dueAt: new Date(Date.now() + 14 * 86400000)
      }
    });
    created.push(ob);
  }

  // Advance nextRunAt and record lastRunAt
  const days = schedule.frequency === 'WEEKLY' ? 7 : schedule.frequency === 'MONTHLY' ? 30 : 90;
  await prisma.recurringSchedule.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: now,
      nextRunAt: new Date(Date.now() + days * 86400000)
    }
  });

  res.json({ generatedCount: created.length, obligations: jsonSafe(created) });
}));

export default router;
