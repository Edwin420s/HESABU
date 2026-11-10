import { Router } from 'express';
import { roscaService } from './roscaService.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

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
      throw new AppError('Access denied to workspace ROSCA cycles', 403, 'FORBIDDEN');
    }

    const cycles = roscaService.listCycles(workspaceId);
    res.json({ workspaceId, cycles });
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
      throw new AppError('Only workspace Owners and Admins can create ROSCA cycles', 403, 'FORBIDDEN');
    }

    const cycle = roscaService.createCycle({
      workspaceId,
      name,
      contributionPerMemberMinor,
      frequencyDays,
      memberIds,
    });

    res.status(201).json(cycle);
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

    if (!memberId || amountMinor === undefined) {
      throw new AppError('memberId and amountMinor are required', 400, 'INVALID_INPUT');
    }

    const result = roscaService.contribute(cycleId, memberId, Number(amountMinor));
    res.json(result);
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
    const result = roscaService.executePayoutAndRotate(cycleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
