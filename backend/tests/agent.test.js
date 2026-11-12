import { describe, it, expect, beforeAll } from 'vitest';
import { AgenticFinanceEngine } from '../src/modules/agent/agentService.js';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Agentic Finance Engine & Specialized Subagents', () => {
  const engine = new AgenticFinanceEngine();
  let token;
  let workspace;

  beforeAll(async () => {
    const email = `agent_tester_${Date.now()}@hesabu.africa`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Agent Tester',
        email,
        password: 'Password123!',
      });
    token = regRes.body.token;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Autonomous Chama Ops',
        type: 'GROUP',
        currency: 'KES',
      });
    workspace = wsRes.body.workspace;
  });

  it('runs CollectionsAgent and returns structured receivables insights', async () => {
    const collections = await engine.runCollectionsAgent({ workspaceId: workspace.id });
    expect(collections).toBeDefined();
    expect(collections.agent).toBe('CollectionsAgent');
    expect(collections.metrics).toBeDefined();
    expect(Array.isArray(collections.debtorAccounts)).toBe(true);
  });

  it('runs ReconciliationAgent and evaluates ledger integrity', async () => {
    const recon = await engine.runReconciliationAgent({ workspaceId: workspace.id });
    expect(recon).toBeDefined();
    expect(recon.agent).toBe('ReconciliationAgent');
    expect(recon.health).toBeDefined();
  });

  it('runs TreasuryAgent and forecasts multi-currency cash runway', async () => {
    const treasury = await engine.runTreasuryAgent({ workspaceId: workspace.id });
    expect(treasury).toBeDefined();
    expect(treasury.agent).toBe('TreasuryAgent');
    expect(Array.isArray(treasury.netCashBalances)).toBe(true);
  });

  it('runs ExpenseAgent and detects anomalies or threshold breaches', async () => {
    const expenseAudit = await engine.runExpenseAgent({ workspaceId: workspace.id });
    expect(expenseAudit).toBeDefined();
    expect(expenseAudit.agent).toBe('ExpenseAgent');
    expect(Array.isArray(expenseAudit.anomalies)).toBe(true);
  });

  it('routes natural language questions to specialized subagents via handleQuery', async () => {
    const collRes = await engine.handleQuery({
      workspaceId: workspace.id,
      question: 'Who owes money and has overdue debt to collect?'
    });
    expect(collRes.agentInvoked).toBe('CollectionsAgent');
    expect(collRes.answer).toBeDefined();

    const treasRes = await engine.handleQuery({
      workspaceId: workspace.id,
      question: 'What is our treasury cash balance in KES and ZAR?'
    });
    expect(treasRes.agentInvoked).toBe('TreasuryAgent');

    const expRes = await engine.handleQuery({
      workspaceId: workspace.id,
      question: 'Check expenses for policy violations, duplicate claims, and anomalies'
    });
    expect(expRes.agentInvoked).toBe('ExpenseAgent');
  });

  it('exposes typed agent tools registry and allows authorized execution over HTTP', async () => {
    // List tools
    const toolsRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/agent/tools`)
      .set('Authorization', `Bearer ${token}`);

    expect(toolsRes.status).toBe(200);
    expect(Array.isArray(toolsRes.body.tools)).toBe(true);
    expect(toolsRes.body.tools.length).toBeGreaterThanOrEqual(4);

    const collectTool = toolsRes.body.tools.find(t => t.name === 'collect_receivables');
    expect(collectTool).toBeDefined();
    expect(collectTool.parameters).toBeDefined();

    // Execute tool
    const execRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/agent/tools/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({ toolName: 'collect_receivables' });

    expect(execRes.status).toBe(200);
    expect(execRes.body.execution).toBeDefined();
    expect(execRes.body.execution.tool.name).toBe('collect_receivables');
    expect(execRes.body.execution.result.agent).toBe('CollectionsAgent');

    // Run expense audit endpoint
    const auditRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/agent/expense-audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.expenseAudit).toBeDefined();
    expect(auditRes.body.expenseAudit.agent).toBe('ExpenseAgent');
  });
});
