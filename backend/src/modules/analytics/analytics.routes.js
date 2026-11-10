import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../shared/errors.js';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/analytics/health-score
 * Computes collaborative financial health metrics:
 * - Collection efficiency percentage
 * - Average settlement turnaround
 * - Expense burn rate vs income
 * - Overall organizational health index (0 to 100)
 */
analyticsRouter.get('/workspaces/:workspaceId/analytics/health-score', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        obligations: true,
        expenses: true,
        memberships: true,
      },
    });

    if (!workspace) throw new AppError('Workspace not found', 404, 'NOT_FOUND');

    const totalObligations = workspace.obligations.length;
    const settledObligations = workspace.obligations.filter((o) => o.status === 'SETTLED').length;
    const collectionRatePct = totalObligations > 0 ? Math.round((settledObligations / totalObligations) * 100) : 100;

    const totalExpectedMinor = workspace.obligations.reduce((sum, o) => sum + o.amountMinor, 0n);
    const totalCollectedMinor = workspace.obligations
      .filter((o) => o.status === 'SETTLED')
      .reduce((sum, o) => sum + o.amountMinor, 0n);

    const approvedExpensesMinor = workspace.expenses
      .filter((e) => e.status === 'APPROVED' || e.status === 'PAID')
      .reduce((sum, e) => sum + e.amountMinor, 0n);

    // Health score formula (weighted collection rate + liquidity buffer)
    let healthScore = collectionRatePct;
    if (totalCollectedMinor > approvedExpensesMinor) {
      healthScore = Math.min(100, healthScore + 5);
    } else if (totalCollectedMinor < approvedExpensesMinor) {
      healthScore = Math.max(20, healthScore - 15);
    }

    const rating = healthScore >= 80 ? 'EXCELLENT' : healthScore >= 60 ? 'HEALTHY' : healthScore >= 40 ? 'CAUTION' : 'AT_RISK';

    res.json({
      healthScore,
      rating,
      metrics: {
        totalObligations,
        settledObligations,
        collectionRatePct,
        totalExpectedMinor: totalExpectedMinor.toString(),
        totalCollectedMinor: totalCollectedMinor.toString(),
        approvedExpensesMinor: approvedExpensesMinor.toString(),
        activeMembers: workspace.memberships.length,
      },
    });
  } catch (err) {
    next(err);
  }
});
