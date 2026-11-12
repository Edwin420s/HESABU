import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';

export class BudgetService {
  constructor() {
    this.budgets = new Map();
  }

  setBudget({ workspaceId, category, allocatedMinor, period = 'MONTHLY' }) {
    const allocated = Number(allocatedMinor);
    const cleanCat = (category || '').toUpperCase();
    const cleanPeriod = (period || 'MONTHLY').toUpperCase();
    const key = `${workspaceId}_${cleanCat}_${cleanPeriod}`;

    const budget = {
      id: `bg_${crypto.randomBytes(8).toString('hex')}`,
      workspaceId,
      category: cleanCat,
      period: cleanPeriod,
      allocatedMinor: allocated,
      updatedAt: new Date()
    };
    this.budgets.set(key, budget);

    // Asynchronously sync to PostgreSQL if database connection is available
    prisma.budget.upsert({
      where: { workspaceId_category_period: { workspaceId, category: cleanCat, period: cleanPeriod } },
      update: { allocatedMinor: BigInt(allocated) },
      create: { workspaceId, category: cleanCat, period: cleanPeriod, allocatedMinor: BigInt(allocated) }
    }).catch(() => {});

    return budget;
  }

  listBudgets(workspaceId) {
    return Array.from(this.budgets.values()).filter(b => b.workspaceId === workspaceId);
  }

  computeVariance(workspaceId, actualExpenses = []) {
    const workspaceBudgets = this.listBudgets(workspaceId);
    let totalAllocated = 0;
    let totalActual = 0;

    const actualMap = {};
    for (const exp of actualExpenses) {
      const cat = (exp.category || '').toUpperCase();
      actualMap[cat] = (actualMap[cat] || 0) + Number(exp.amountMinor);
    }

    const categories = workspaceBudgets.map(b => {
      const actual = actualMap[b.category] || 0;
      const variance = b.allocatedMinor - actual;
      totalAllocated += b.allocatedMinor;
      totalActual += actual;

      const util = b.allocatedMinor > 0 ? actual / b.allocatedMinor : 0;
      let status = 'ON_TRACK';
      if (util > 1.0) status = 'OVER_BUDGET';
      else if (util >= 0.8) status = 'WARNING';

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
