import { Router } from 'express';
import { budgetService } from './budgetService.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { jsonSafe } from '../../shared/money.js';

export const budgetRouter = Router();

budgetRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/budgets
 * List configured budget limits
 */
budgetRouter.get('/workspaces/:workspaceId/budgets', async (req, res, next) => {
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

    if (!membership) throw new AppError('Access denied.', 403, 'FORBIDDEN');

    const budgets = await budgetService.listBudgets(workspaceId);
    res.json({ workspaceId, budgets: jsonSafe(budgets) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:workspaceId/budgets
 * Set budget allocation for a category
 */
budgetRouter.post('/workspaces/:workspaceId/budgets', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { category, allocatedMinor, period, alertThresholdPercent } = req.body;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN' && membership.role !== 'FINANCE_MANAGER')) {
      throw new AppError('Only Owners, Admins, or Finance Managers can configure budgets.', 403, 'FORBIDDEN');
    }

    if (!category || allocatedMinor === undefined) {
      throw new AppError('category and allocatedMinor are required.', 400, 'INVALID_INPUT');
    }

    const budget = await budgetService.setBudget({
      workspaceId,
      category,
      allocatedMinor,
      period,
      alertThresholdPercent: alertThresholdPercent || 80
    });

    res.status(201).json(jsonSafe(budget));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/workspaces/:workspaceId/budgets/variance
 * Compute live budget vs actual variance
 */
budgetRouter.get('/workspaces/:workspaceId/budgets/variance', async (req, res, next) => {
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

    if (!membership) throw new AppError('Access denied.', 403, 'FORBIDDEN');

    const variance = await budgetService.computeVariance(workspaceId);
    res.json(jsonSafe(variance));
  } catch (err) {
    next(err);
  }
});
