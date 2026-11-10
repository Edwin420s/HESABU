import { describe, it, expect, beforeEach } from 'vitest';
import { BudgetService } from '../src/modules/budget/budgetService.js';

describe('Budget vs Actual Expense Variance Engine', () => {
  let budget;

  beforeEach(() => {
    budget = new BudgetService();
  });

  it('allocates and lists category budgets', () => {
    const b1 = budget.setBudget({
      workspaceId: 'ws_demo',
      category: 'OPERATIONS',
      allocatedMinor: 5000000, // 50,000 KES
    });

    expect(b1.category).toBe('OPERATIONS');
    expect(b1.allocatedMinor).toBe(5000000);

    const list = budget.listBudgets('ws_demo');
    expect(list.length).toBe(1);
    expect(list[0].category).toBe('OPERATIONS');
  });

  it('computes variance correctly with ON_TRACK, WARNING, and OVER_BUDGET statuses', () => {
    budget.setBudget({ workspaceId: 'ws_demo', category: 'OFFICE', allocatedMinor: 1000000 }); // 10k
    budget.setBudget({ workspaceId: 'ws_demo', category: 'TRAVEL', allocatedMinor: 1000000 }); // 10k
    budget.setBudget({ workspaceId: 'ws_demo', category: 'MARKETING', allocatedMinor: 1000000 }); // 10k

    const actualExpenses = [
      { category: 'OFFICE', amountMinor: 500000 }, // 50% => ON_TRACK
      { category: 'TRAVEL', amountMinor: 850000 }, // 85% => WARNING
      { category: 'MARKETING', amountMinor: 1200000 }, // 120% => OVER_BUDGET
    ];

    const result = budget.computeVariance('ws_demo', actualExpenses);

    expect(result.totalAllocatedMinor).toBe(3000000);
    expect(result.totalActualMinor).toBe(2550000);
    expect(result.totalVarianceMinor).toBe(450000);
    expect(result.overallUtilizationPct).toBe(85);

    const office = result.categories.find((c) => c.category === 'OFFICE');
    expect(office.status).toBe('ON_TRACK');
    expect(office.varianceMinor).toBe(500000);

    const travel = result.categories.find((c) => c.category === 'TRAVEL');
    expect(travel.status).toBe('WARNING');

    const marketing = result.categories.find((c) => c.category === 'MARKETING');
    expect(marketing.status).toBe('OVER_BUDGET');
    expect(marketing.varianceMinor).toBe(-200000);
  });
});
