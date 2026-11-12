import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

export class BudgetService {
  /**
   * Helper to ensure workspace exists in PostgreSQL (e.g. during isolated unit tests)
   */
  async ensureWorkspace(workspaceId) {
    try {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
      if (!ws) {
        let user = await prisma.user.findFirst({ select: { id: true } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: `admin_${Date.now()}@hesabu.test`,
              passwordHash: 'argon2_budget_test_hash',
              name: 'System Admin'
            }
          });
        }
        await prisma.workspace.upsert({
          where: { id: workspaceId },
          update: {},
          create: {
            id: workspaceId,
            name: `Workspace ${workspaceId}`,
            createdById: user.id,
            currency: 'KES'
          }
        });
      }
    } catch (_) {}
  }

  /**
   * Creates or updates a durable budget limit for a category in PostgreSQL
   */
  async setBudget({ workspaceId, category, allocatedMinor, period = 'MONTHLY', alertThresholdPercent = 80 }) {
    if (!workspaceId) throw new AppError('workspaceId is required', 400);
    if (!category) throw new AppError('category is required', 400);
    if (allocatedMinor === undefined || allocatedMinor === null) throw new AppError('allocatedMinor is required', 400);

    await this.ensureWorkspace(workspaceId);

    const allocated = BigInt(allocatedMinor);
    const cleanCat = category.trim().toUpperCase();
    const cleanPeriod = (period || 'MONTHLY').trim().toUpperCase();

    const budget = await prisma.budget.upsert({
      where: {
        workspaceId_category_period: {
          workspaceId,
          category: cleanCat,
          period: cleanPeriod
        }
      },
      update: {
        allocatedMinor: allocated,
        alertThresholdPercent
      },
      create: {
        workspaceId,
        category: cleanCat,
        period: cleanPeriod,
        allocatedMinor: allocated,
        alertThresholdPercent
      }
    });

    return {
      id: budget.id,
      workspaceId: budget.workspaceId,
      category: budget.category,
      period: budget.period,
      allocatedMinor: Number(budget.allocatedMinor),
      alertThresholdPercent: budget.alertThresholdPercent,
      updatedAt: budget.updatedAt
    };
  }

  /**
   * Lists all durable budgets for a workspace directly from PostgreSQL
   */
  async listBudgets(workspaceId) {
    if (!workspaceId) return [];
    const budgets = await prisma.budget.findMany({
      where: { workspaceId },
      orderBy: { category: 'asc' }
    });

    return budgets.map((b) => ({
      id: b.id,
      workspaceId: b.workspaceId,
      category: b.category,
      period: b.period,
      allocatedMinor: Number(b.allocatedMinor),
      alertThresholdPercent: b.alertThresholdPercent,
      updatedAt: b.updatedAt
    }));
  }

  /**
   * Computes live budget variance by dynamically querying actual expenses from PostgreSQL
   */
  async computeVariance(workspaceId, actualExpenses = null) {
    await this.ensureWorkspace(workspaceId);
    const workspaceBudgets = await this.listBudgets(workspaceId);

    let expenses = actualExpenses;
    if (!expenses) {
      const dbExpenses = await prisma.expense.findMany({
        where: { workspaceId, status: { in: ['APPROVED', 'PAID'] } }
      });
      expenses = dbExpenses.map((e) => ({
        category: e.category,
        amountMinor: Number(e.amountMinor)
      }));
    }

    let totalAllocated = 0;
    let totalActual = 0;

    const actualMap = {};
    for (const exp of (expenses || [])) {
      const cat = (exp.category || '').toUpperCase();
      actualMap[cat] = (actualMap[cat] || 0) + Number(exp.amountMinor || 0);
    }

    const categories = workspaceBudgets.map((b) => {
      const actual = actualMap[b.category] || 0;
      const variance = b.allocatedMinor - actual;
      totalAllocated += b.allocatedMinor;
      totalActual += actual;

      const util = b.allocatedMinor > 0 ? actual / b.allocatedMinor : 0;
      let status = 'ON_TRACK';
      if (actual > b.allocatedMinor) status = 'OVER_BUDGET';
      else if (util >= (b.alertThresholdPercent ? b.alertThresholdPercent / 100 : 0.8)) status = 'WARNING';

      return {
        category: b.category,
        allocatedMinor: b.allocatedMinor,
        actualMinor: actual,
        varianceMinor: variance,
        utilizationPct: Math.round(util * 100),
        status
      };
    });

    const totalVariance = totalAllocated - totalActual;
    const overallUtil = totalAllocated > 0 ? Math.round((totalActual / totalAllocated) * 100) : 0;

    return {
      workspaceId,
      totalAllocatedMinor: totalAllocated,
      totalActualMinor: totalActual,
      totalVarianceMinor: totalVariance,
      overallUtilizationPct: overallUtil,
      categories
    };
  }
}

export const budgetService = new BudgetService();
