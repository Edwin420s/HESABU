import { Router } from 'express';
import { roscaService } from './roscaService.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { jsonSafe } from '../../shared/money.js';

export const roscaRouter = Router();

roscaRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/rosca
 * List ROSCA cycles
 */
roscaRouter.get('/workspaces/:workspaceId/rosca', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError('Access denied to workspace ROSCA cycles.', 403, 'FORBIDDEN');
    }

    const cycles = await roscaService.listCycles(workspaceId);
    res.json({ workspaceId, cycles: jsonSafe(cycles) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:workspaceId/rosca
 * Create a new ROSCA cycle
 */
roscaRouter.post('/workspaces/:workspaceId/rosca', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { name, contributionPerMemberMinor, frequencyDays, memberIds } = req.body;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError('Only workspace Owners and Admins can create ROSCA cycles.', 403, 'FORBIDDEN');
    }

    const cycle = await roscaService.createCycle({
      workspaceId,
      name,
      contributionPerMemberMinor,
      frequencyDays,
      memberIds,
      actorId: req.user.id
    });

    res.status(201).json(jsonSafe(cycle));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rosca/:cycleId/contribute
 * Record member contribution into the round pot
 */
roscaRouter.post('/rosca/:cycleId/contribute', async (req, res, next) => {
  try {
    const { cycleId } = req.params;
    const { memberId, amountMinor } = req.body;

    if (amountMinor === undefined) {
      throw new AppError('amountMinor is required', 400, 'INVALID_INPUT');
    }

    const cycle = await roscaService.getCycle(cycleId);
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId: cycle.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError('Access denied to this ROSCA cycle.', 403, 'FORBIDDEN');
    }

    // Determine target contributing member: caller's own membership unless admin/owner
    const targetMemberId = (membership.role === 'OWNER' || membership.role === 'ADMIN') && memberId
      ? memberId
      : membership.id;

    const result = await roscaService.contribute(cycleId, targetMemberId, amountMinor, req.user.id);
    res.json(jsonSafe(result));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rosca/:cycleId/payout
 * Disburse round pot to the current beneficiary and rotate
 */
roscaRouter.post('/rosca/:cycleId/payout', async (req, res, next) => {
  try {
    const { cycleId } = req.params;
    const cycle = await roscaService.getCycle(cycleId);

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId: cycle.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
      throw new AppError('Only workspace Owners, Admins, or Finance Managers can authorize ROSCA pot payouts.', 403, 'FORBIDDEN');
    }

    const roundNumber = req.body.roundNumber || cycle.currentRound;
    const result = await roscaService.disburseRound(cycleId, Number(roundNumber), req.user.id);
    res.json(jsonSafe(result));
  } catch (err) {
    next(err);
  }
});
