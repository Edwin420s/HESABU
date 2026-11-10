import crypto from 'crypto';

export class BudgetService {
  constructor() {
    this.budgets = new Map();
  }

  /**
   * Set or update a budget limit for a category in a fiscal period
   */
  setBudget({ workspaceId, category, allocatedMinor, period = 'MONTHLY' }) {
    if (!workspaceId || !category) {
      throw new Error('workspaceId and category are required');
    }
    const allocated = Number(allocatedMinor);
    if (allocated <= 0) {
      throw new Error('Allocated budget must be positive');
    }

    const key = `${workspaceId}_${category.toUpperCase()}_${period.toUpperCase()}`;
    const budget = {
      id: `bg_${crypto.randomBytes(10).toString('hex')}`,
      workspaceId,
      category: category.toUpperCase(),
      period: period.toUpperCase(),
      allocatedMinor: allocated,
      updatedAt: new Date(),
    };

    this.budgets.set(key, budget);
    return budget;
  }

  /**
   * Retrieve all budgets for a workspace
   */
  listBudgets(workspaceId) {
    return Array.from(this.budgets.values()).filter((b) => b.workspaceId === workspaceId);
  }

  /**
   * Compute variance comparing allocated budget against actual recorded expenses
   * @param {string} workspaceId
   * @param {Array<{ category: string, amountMinor: number }>} actualExpenses
   */
  computeVariance(workspaceId, actualExpenses = []) {
    const workspaceBudgets = this.listBudgets(workspaceId);

    // Group actual expenses by category
    const actualByCategory = {};
    for (const exp of actualExpenses) {
      const cat = (exp.category || 'GENERAL').toUpperCase();
      actualByCategory[cat] = (actualByCategory[cat] || 0) + Number(exp.amountMinor || 0);
    }

    const report = [];
    let totalAllocatedMinor = 0;
    let totalActualMinor = 0;

    for (const budget of workspaceBudgets) {
      const actual = actualByCategory[budget.category] || 0;
      const varianceMinor = budget.allocatedMinor - actual;
      const pctConsumed = Math.round((actual / budget.allocatedMinor) * 100);

      let status = 'ON_TRACK';
      if (pctConsumed >= 100) {
        status = 'OVER_BUDGET';
      } else if (pctConsumed >= 80) {
        status = 'WARNING';
      }

      totalAllocatedMinor += budget.allocatedMinor;
      totalActualMinor += actual;

      report.push({
        category: budget.category,
        period: budget.period,
        allocatedMinor: budget.allocatedMinor,
        actualMinor: actual,
        varianceMinor,
        utilizationPct: pctConsumed,
        status,
      });
    }

    const totalVarianceMinor = totalAllocatedMinor - totalActualMinor;
    const overallUtilizationPct = totalAllocatedMinor > 0 ? Math.round((totalActualMinor / totalAllocatedMinor) * 100) : 0;

    return {
      workspaceId,
      totalAllocatedMinor,
      totalActualMinor,
      totalVarianceMinor,
      overallUtilizationPct,
      categories: report,
    };
  }
}

export const budgetService = new BudgetService();
