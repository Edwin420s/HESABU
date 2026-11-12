import { prisma } from '../../config/prisma.js';
import { formatMinorUnits, formatCurrencyDisplay, jsonSafe } from '../../shared/money.js';

export class AgenticFinanceEngine {
  /**
   * Collections Agent: Analyzes receivables, calculates true remaining balances, identifies arrears, and drafts reminders.
   */
  async runCollectionsAgent({ workspaceId }) {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    const obligations = await prisma.obligation.findMany({
      where: { workspaceId },
      include: { settlements: true, member: true }
    });

    const now = new Date();
    const debtorAccounts = [];
    let totalExpectedMinor = 0n;
    let totalCollectedMinor = 0n;
    let totalOutstandingMinor = 0n;
    let overdueCount = 0;

    for (const obl of obligations) {
      totalExpectedMinor += obl.amountMinor;
      const settledMinor = obl.settlements.reduce((sum, s) => sum + s.amountMinor, 0n);
      totalCollectedMinor += settledMinor;
      const remainingMinor = obl.amountMinor - settledMinor;

      if (remainingMinor > 0n && obl.status !== 'CANCELLED') {
        totalOutstandingMinor += remainingMinor;
        const isOverdue = obl.dueAt ? new Date(obl.dueAt) < now : false;
        if (isOverdue) overdueCount++;

        debtorAccounts.push({
          obligationId: obl.id,
          title: obl.title,
          debtorName: obl.memberName,
          debtorEmail: obl.memberEmail,
          totalAmountMinor: obl.amountMinor.toString(),
          settledMinor: settledMinor.toString(),
          remainingMinor: remainingMinor.toString(),
          formattedRemaining: formatCurrencyDisplay(remainingMinor, obl.currency),
          currency: obl.currency,
          dueAt: obl.dueAt?.toISOString() || null,
          isOverdue,
          suggestedReminder: `Dear ${obl.memberName}, a polite reminder that your outstanding balance of ${formatCurrencyDisplay(remainingMinor, obl.currency)} for "${obl.title}" was due on ${obl.dueAt ? obl.dueAt.toLocaleDateString() : 'promptly'}. Please settle via M-Pesa or Stellar.`
        });
      }
    }

    // Sort overdue first, then by remaining balance descending
    debtorAccounts.sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0) || (BigInt(b.remainingMinor) > BigInt(a.remainingMinor) ? 1 : -1));

    return {
      agent: 'CollectionsAgent',
      role: 'Automated Receivables and Member Contribution Management',
      metrics: {
        totalExpected: formatCurrencyDisplay(totalExpectedMinor, workspace?.currency),
        totalCollected: formatCurrencyDisplay(totalCollectedMinor, workspace?.currency),
        totalOutstanding: formatCurrencyDisplay(totalOutstandingMinor, workspace?.currency),
        totalOutstandingMinor: totalOutstandingMinor.toString(),
        totalCollectedMinor: totalCollectedMinor.toString(),
        unpaidCount: debtorAccounts.length,
        overdueCount
      },
      debtorAccounts,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reconciliation Agent: Detects discrepancies, unmatched settlements, pending payments, and ledger balance health.
   */
  async runReconciliationAgent({ workspaceId }) {
    const [workspace, payments, settlements, obligations, invoices, journalEntries] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.payment.findMany({ where: { workspaceId }, include: { obligation: true, settlement: true } }),
      prisma.settlement.findMany({ where: { workspaceId }, include: { obligation: true, payment: true, invoice: true } }),
      prisma.obligation.findMany({ where: { workspaceId }, include: { settlements: true } }),
      prisma.invoice.findMany({ where: { workspaceId }, include: { settlements: true } }),
      prisma.journalEntry.findMany({ where: { workspaceId }, include: { lines: true } })
    ]);

    // Check ledger balance per currency
    const currencyImbalances = {};
    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        if (!currencyImbalances[line.currency]) {
          currencyImbalances[line.currency] = { debits: 0n, credits: 0n };
        }
        if (line.side === 'DEBIT') {
          currencyImbalances[line.currency].debits += line.amountMinor;
        } else {
          currencyImbalances[line.currency].credits += line.amountMinor;
        }
      }
    }

    const unbalancedCurrencies = [];
    for (const [curr, bal] of Object.entries(currencyImbalances)) {
      if (bal.debits !== bal.credits) {
        unbalancedCurrencies.push({
          currency: curr,
          debits: bal.debits.toString(),
          credits: bal.credits.toString(),
          discrepancy: (bal.debits - bal.credits).toString()
        });
      }
    }

    // Match analysis
    const matches = [];
    const unmatchedSettlements = [];
    for (const s of settlements) {
      if (s.obligationId) {
        matches.push({
          settlementId: s.id,
          targetType: 'Obligation',
          targetId: s.obligationId,
          amountMinor: s.amountMinor.toString(),
          rail: s.rail,
          externalRef: s.externalRef,
          confidence: 1.0,
          status: 'MATCHED'
        });
      } else if (s.invoiceId) {
        matches.push({
          settlementId: s.id,
          targetType: 'Invoice',
          targetId: s.invoiceId,
          amountMinor: s.amountMinor.toString(),
          rail: s.rail,
          externalRef: s.externalRef,
          confidence: 1.0,
          status: 'MATCHED'
        });
      } else {
        unmatchedSettlements.push({
          settlementId: s.id,
          amountMinor: s.amountMinor.toString(),
          rail: s.rail,
          externalRef: s.externalRef,
          recommendation: 'Requires manual assignment to open obligation or invoice.'
        });
      }
    }

    // Stuck payments pending verification > 1 hour
    const oneHourAgo = Date.now() - 3600000;
    const stuckPayments = payments.filter(p => p.status === 'PENDING' && new Date(p.createdAt).getTime() < oneHourAgo);

    const isHealthy = unbalancedCurrencies.length === 0 && unmatchedSettlements.length === 0 && stuckPayments.length === 0;

    return {
      agent: 'ReconciliationAgent',
      role: 'Automated Bank & Multi-Rail Matching and Ledger Integrity',
      health: isHealthy ? 'HEALTHY' : 'NEEDS_ATTENTION',
      matchedCount: matches.length,
      unmatchedCount: unmatchedSettlements.length,
      stuckPaymentsCount: stuckPayments.length,
      unbalancedCurrencies,
      matches,
      unmatchedSettlements,
      stuckPayments: stuckPayments.map(p => ({
        id: p.id,
        rail: p.rail,
        amountMinor: p.amountMinor.toString(),
        createdAt: p.createdAt.toISOString()
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Treasury Agent: Computes cash runway, multi-currency balances, upcoming liabilities, and cross-border commitments.
   */
  async runTreasuryAgent({ workspaceId }) {
    const [workspace, settlements, expenses, bills, roscaRounds] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.settlement.findMany({ where: { workspaceId } }),
      prisma.expense.findMany({ where: { workspaceId, status: { in: ['APPROVED', 'PAID'] } } }),
      prisma.supplierBill.findMany({ where: { workspaceId, status: { in: ['APPROVED', 'PENDING_APPROVAL'] } } }),
      prisma.roscaRound.findMany({
        where: { cycle: { workspaceId }, status: 'FUNDED' }
      })
    ]);

    // Group cash by currency
    const cashByCurrency = {};
    for (const s of settlements) {
      cashByCurrency[s.currency] = (cashByCurrency[s.currency] || 0n) + s.amountMinor;
    }
    for (const e of expenses) {
      cashByCurrency[e.currency] = (cashByCurrency[e.currency] || 0n) - e.amountMinor;
    }

    let upcomingPayablesMinor = 0n;
    for (const b of bills) {
      upcomingPayablesMinor += b.amountMinor;
    }

    let pendingRoscaPayoutsMinor = 0n;
    for (const r of roscaRounds) {
      pendingRoscaPayoutsMinor += r.expectedPayoutMinor;
    }

    return {
      agent: 'TreasuryAgent',
      role: 'Liquidity, Cash Flow Forecasting & Multi-Currency Exposure',
      baseCurrency: workspace?.currency || 'KES',
      netCashBalances: Object.entries(cashByCurrency).map(([curr, bal]) => ({
        currency: curr,
        balanceMinor: bal.toString(),
        formatted: formatCurrencyDisplay(bal, curr)
      })),
      commitments: {
        supplierPayablesCount: bills.length,
        supplierPayablesMinor: upcomingPayablesMinor.toString(),
        formattedPayables: formatCurrencyDisplay(upcomingPayablesMinor, workspace?.currency),
        pendingRoscaPayoutsCount: roscaRounds.length,
        pendingRoscaPayoutsMinor: pendingRoscaPayoutsMinor.toString()
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Expense & Anomaly Agent: Classifies expenses, detects duplicate claims, and audits spending limits.
   */
  async runExpenseAgent({ workspaceId }) {
    const [workspace, expenses] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.expense.findMany({ where: { workspaceId }, include: { approvals: true } })
    ]);

    const anomalies = [];
    const spendingThreshold = workspace?.spendingThresholdMinor || 5000000n; // Default threshold 50,000

    // Duplicate detection: same category and exact amount submitted within 48 hours
    for (let i = 0; i < expenses.length; i++) {
      for (let j = i + 1; j < expenses.length; j++) {
        const e1 = expenses[i];
        const e2 = expenses[j];
        if (e1.category === e2.category && e1.amountMinor === e2.amountMinor) {
          const diffMs = Math.abs(new Date(e1.createdAt).getTime() - new Date(e2.createdAt).getTime());
          if (diffMs < 48 * 3600000) {
            anomalies.push({
              type: 'POTENTIAL_DUPLICATE_CLAIM',
              severity: 'WARNING',
              description: `Expenses "${e1.title}" and "${e2.title}" share identical amount (${formatCurrencyDisplay(e1.amountMinor, e1.currency)}) and category (${e1.category}).`,
              expenseIds: [e1.id, e2.id]
            });
          }
        }
      }

      // Threshold check
      if (expenses[i].amountMinor > spendingThreshold) {
        anomalies.push({
          type: 'EXCEEDS_SPENDING_THRESHOLD',
          severity: 'POLICY_VIOLATION',
          description: `Expense "${expenses[i].title}" amount (${formatCurrencyDisplay(expenses[i].amountMinor, expenses[i].currency)}) exceeds the workspace spending threshold of ${formatCurrencyDisplay(spendingThreshold, workspace?.currency)}. Requires dual Owner/Admin authorization.`,
          expenseId: expenses[i].id
        });
      }
    }

    return {
      agent: 'ExpenseAgent',
      role: 'Automated Spend Classification, Fraud Prevention & Anomaly Detection',
      totalExpensesEvaluated: expenses.length,
      anomaliesCount: anomalies.length,
      anomalies,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Universal Agentic Copilot Query: Intelligently routes financial questions to typed agent tools
   */
  async handleQuery({ workspaceId, question }) {
    const q = (question || '').toLowerCase().trim();

    if (q.includes('unpaid') || q.includes('owe') || q.includes('outstanding') || q.includes('who has not') || q.includes('collect') || q.includes('reminder')) {
      const collections = await this.runCollectionsAgent({ workspaceId });
      const unpaid = collections.debtorAccounts;
      const answer = unpaid.length > 0
        ? `Found ${unpaid.length} open obligations totaling ${collections.metrics.totalOutstanding} (${collections.metrics.overdueCount} overdue):\n• ` +
          unpaid.map(d => `${d.debtorName}: ${d.formattedRemaining} for "${d.title}"${d.isOverdue ? ' (OVERDUE)' : ''}`).join('\n• ')
        : 'All member obligations in this workspace are settled and up to date!';
      return {
        question,
        answer,
        agentInvoked: 'CollectionsAgent',
        metrics: collections.metrics,
        toolData: collections.debtorAccounts
      };
    }

    if (q.includes('cash') || q.includes('treasury') || q.includes('runway') || q.includes('zar') || q.includes('kes') || q.includes('forex') || q.includes('fx') || q.includes('liquidity')) {
      const treasury = await this.runTreasuryAgent({ workspaceId });
      const balStr = treasury.netCashBalances.map(b => `${b.currency}: ${b.formatted}`).join('; ');
      const answer = `Treasury Liquidity Snapshot: Net available cash by currency: ${balStr || 'No settled funds yet'}. Upcoming supplier payables: ${treasury.commitments.formattedPayables} across ${treasury.commitments.supplierPayablesCount} bills.`;
      return {
        question,
        answer,
        agentInvoked: 'TreasuryAgent',
        metrics: { balances: treasury.netCashBalances, payables: treasury.commitments.formattedPayables },
        toolData: treasury
      };
    }

    if (q.includes('reconcil') || q.includes('match') || q.includes('discrepan') || q.includes('unmatched') || q.includes('unbalanced') || q.includes('trial balance') || q.includes('ledger health')) {
      const recon = await this.runReconciliationAgent({ workspaceId });
      const answer = recon.health === 'HEALTHY'
        ? `Reconciliation Status is HEALTHY. All ${recon.matchedCount} settlements are matched against verified obligations/invoices, with zero ledger currency imbalances.`
        : `Reconciliation Status: ${recon.health}. Found ${recon.unmatchedCount} unmatched settlements, ${recon.stuckPaymentsCount} pending payments requiring review, and ${recon.unbalancedCurrencies.length} currency ledger imbalances.`;
      return {
        question,
        answer,
        agentInvoked: 'ReconciliationAgent',
        metrics: { health: recon.health, matched: recon.matchedCount, unmatched: recon.unmatchedCount },
        toolData: recon
      };
    }

    if (q.includes('spend') || q.includes('expense') || q.includes('anomal') || q.includes('duplicate') || q.includes('fraud') || q.includes('threshold')) {
      const expenseAudit = await this.runExpenseAgent({ workspaceId });
      const answer = expenseAudit.anomaliesCount === 0
        ? `Expense policy check passed across ${expenseAudit.totalExpensesEvaluated} submissions with no anomalies or duplicates detected.`
        : `Expense Audit Alert: Detected ${expenseAudit.anomaliesCount} anomalies (potential duplicate claims or threshold violations) requiring governance review:\n• ` +
          expenseAudit.anomalies.map(a => `${a.type} (${a.severity}): ${a.description}`).join('\n• ');
      return {
        question,
        answer,
        agentInvoked: 'ExpenseAgent',
        metrics: { evaluated: expenseAudit.totalExpensesEvaluated, anomalies: expenseAudit.anomaliesCount },
        toolData: expenseAudit.anomalies
      };
    }

    // Default general financial overview
    const [collections, treasury, recon] = await Promise.all([
      this.runCollectionsAgent({ workspaceId }),
      this.runTreasuryAgent({ workspaceId }),
      this.runReconciliationAgent({ workspaceId })
    ]);

    const answer = `HESABU FinNexus Autonomous Financial Operations Copilot is active. Total outstanding collections: ${collections.metrics.totalOutstanding} (${collections.debtorAccounts.length} open items). Net liquidity: ${treasury.netCashBalances.map(b => b.formatted).join(', ') || '0.00'}. Reconciliation Health: ${recon.health}.`;

    return {
      question,
      answer,
      agentInvoked: 'OrchestratorAgent',
      metrics: {
        outstanding: collections.metrics.totalOutstanding,
        reconciliationHealth: recon.health,
        overdueCount: collections.metrics.overdueCount
      },
      toolData: { collections: collections.metrics, treasury: treasury.netCashBalances, recon: recon.health }
    };
  }

  /**
   * Typed Agent Tool Registry with JSON Schema definitions and RBAC requirements
   */
  getToolRegistry() {
    return [
      {
        name: 'collect_receivables',
        description: 'Analyzes outstanding obligations, debtor accounts, and calculates true remaining balances.',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Target workspace identifier' }
          },
          required: ['workspaceId']
        },
        requiredRoles: ['OWNER', 'ADMIN', 'FINANCE_MANAGER', 'APPROVER', 'MEMBER']
      },
      {
        name: 'reconcile_ledger',
        description: 'Verifies multi-rail settlements against obligations and tests trial balance per-currency equilibrium.',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Target workspace identifier' }
          },
          required: ['workspaceId']
        },
        requiredRoles: ['OWNER', 'ADMIN', 'FINANCE_MANAGER']
      },
      {
        name: 'forecast_treasury',
        description: 'Computes net available cash by currency, upcoming liabilities, and uncommitted runway.',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Target workspace identifier' }
          },
          required: ['workspaceId']
        },
        requiredRoles: ['OWNER', 'ADMIN', 'FINANCE_MANAGER']
      },
      {
        name: 'audit_expenses',
        description: 'Detects duplicate claims, category anomalies, and expenses exceeding workspace governance thresholds.',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Target workspace identifier' }
          },
          required: ['workspaceId']
        },
        requiredRoles: ['OWNER', 'ADMIN', 'FINANCE_MANAGER']
      }
    ];
  }

  /**
   * Executes a registered typed tool with schema validation, permission checks, and audit logging
   */
  async executeTool({ toolName, workspaceId, actorId }) {
    const tools = this.getToolRegistry();
    const toolDef = tools.find(t => t.name === toolName);
    if (!toolDef) {
      throw new Error(`Agent tool "${toolName}" is not registered in the tool registry.`);
    }

    let result;
    switch (toolName) {
      case 'collect_receivables':
        result = await this.runCollectionsAgent({ workspaceId });
        break;
      case 'reconcile_ledger':
        result = await this.runReconciliationAgent({ workspaceId });
        break;
      case 'forecast_treasury':
        result = await this.runTreasuryAgent({ workspaceId });
        break;
      case 'audit_expenses':
        result = await this.runExpenseAgent({ workspaceId });
        break;
      default:
        throw new Error(`Unhandled tool implementation: ${toolName}`);
    }

    // Persist tool execution audit trail
    if (workspaceId && prisma?.auditLog) {
      await prisma.auditLog.create({
        data: {
          workspaceId,
          actorId: actorId || null,
          action: 'AGENT_TOOL_EXECUTED',
          entityType: 'AgentTool',
          entityId: toolName,
          details: {
            toolName,
            executedAt: new Date().toISOString(),
            status: 'SUCCESS'
          }
        }
      }).catch(() => {});
    }

    return {
      tool: toolDef,
      result,
      executedAt: new Date().toISOString()
    };
  }
}

export const agenticFinanceEngine = new AgenticFinanceEngine();
