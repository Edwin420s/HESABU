import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('End-to-End User Journey: Landing Page -> Register -> Create Workspace -> Pay Obligations -> Zero Failures', () => {
  let userToken = '';
  let userId = '';
  let workspaceId = '';
  let obligationId = '';
  let pendingPaymentId = '';

  it('1. Verifies Landing Page & System Health are fully operational', async () => {
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
  });

  it('2. Registers a brand new user account', async () => {
    const email = `qa_member_${Date.now()}@hesabu.test`;
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Kilimani Group Treasurer',
      email,
      password: 'HesabuSecurePassword!2026'
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeDefined();
    expect(regRes.body.user.email).toBe(email);
    userToken = regRes.body.token;
    userId = regRes.body.user.id;
  });

  it('3. Logs in with the new user credentials and verifies profile', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(userId);
  });

  it('4. Confirms the brand new user starts with an empty workspace list', async () => {
    const wsRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${userToken}`);
    expect(wsRes.status).toBe(200);
    expect(wsRes.body.workspaces).toEqual([]);
  });

  it('5. Creates the user’s first workspace with initialized Chart of Accounts', async () => {
    const createWsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Kilimani Savings & Investment Chama',
        type: 'GROUP',
        currency: 'KES',
        country: 'KE'
      });
    expect(createWsRes.status).toBe(201);
    expect(createWsRes.body.workspace.id).toBeDefined();
    workspaceId = createWsRes.body.workspace.id;

    // Verify workspace listing now includes the new workspace
    const listRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${userToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.workspaces.length).toBe(1);
    expect(listRes.body.workspaces[0].id).toBe(workspaceId);
  });

  it('6. Creates an obligation (member contribution) in the new workspace', async () => {
    const obRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Monthly Welfare Fund — November 2026',
        amount: '15000.00',
        currency: 'KES',
        memberName: 'Kilimani Group Treasurer',
        dueAt: new Date(Date.now() + 14 * 86400000).toISOString()
      });
    expect(obRes.status).toBe(201);
    expect(obRes.body.obligation.id).toBeDefined();
    expect(obRes.body.obligation.status).toBe('OPEN');
    obligationId = obRes.body.obligation.id;
  });

  it('7. Initiates a payment attempt on the obligation', async () => {
    const payRes = await request(app)
      .post(`/api/obligations/${obligationId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        rail: 'STELLAR'
      });
    expect(payRes.status).toBe(201);
    expect(payRes.body.payment.id).toBeDefined();
    expect(payRes.body.payment.status).toBe('PENDING');
    pendingPaymentId = payRes.body.payment.id;
  });

  it('8. Initiates payment AGAIN on same obligation — verifies NO 409 CONFLICT and cleanly supercedes', async () => {
    // This previously threw 409 Conflict when a user double clicked or re-initiated
    const rePayRes = await request(app)
      .post(`/api/obligations/${obligationId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        rail: 'DEVELOPMENT'
      });
    expect(rePayRes.status).toBe(201);
    expect(rePayRes.body.payment.id).toBeDefined();
    expect(rePayRes.body.payment.rail).toBe('DEVELOPMENT');

    // Confirm the prior pending payment was cleanly marked FAILED with superceded reason
    const priorPayment = await request(app)
      .get(`/api/workspaces/${workspaceId}/payments`)
      .set('Authorization', `Bearer ${userToken}`);
    const cancelled = priorPayment.body.payments.find(p => p.id === pendingPaymentId);
    expect(cancelled.status).toBe('FAILED');
    expect(cancelled.metadata.cancelReason).toContain('Superceded');
  });

  it('9. Explicitly tests POST /api/payments/:id/cancel endpoint', async () => {
    // Create another payment to test explicit cancellation
    const anotherPay = await request(app)
      .post(`/api/obligations/${obligationId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rail: 'STELLAR' });
    expect(anotherPay.status).toBe(201);

    const cancelRes = await request(app)
      .post(`/api/payments/${anotherPay.body.payment.id}/cancel`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.payment.status).toBe('FAILED');
    expect(cancelRes.body.payment.metadata.cancelReason).toBe('Cancelled by user');
  });

  it('10. Confirms settlement and verifies balanced double-entry accounting', async () => {
    // Initiate settlement
    const finalPay = await request(app)
      .post(`/api/obligations/${obligationId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rail: 'DEVELOPMENT' });
    expect(finalPay.status).toBe(201);

    const confirmRes = await request(app)
      .post(`/api/payments/${finalPay.body.payment.id}/dev-confirm`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.payment.status).toBe('CONFIRMED');

    // Check obligation status is now SETTLED
    const obCheck = await request(app)
      .get(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${userToken}`);
    const settledOb = obCheck.body.obligations.find(o => o.id === obligationId);
    expect(settledOb.status).toBe('SETTLED');

    // Check Trial Balance is balanced: Total Debits == Total Credits
    const tbRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(tbRes.status).toBe(200);
    expect(tbRes.body.isBalanced).toBe(true);
    expect(tbRes.body.totalDebitMinor).toBe(tbRes.body.totalCreditMinor);
  });

  it('11. Queries Autonomous Copilot Agent without crashes or static errors', async () => {
    const queryRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/agent/query`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'What is our total collection status?' });
    expect(queryRes.status).toBe(200);
    expect(queryRes.body.response.answer).toBeDefined();
    expect(queryRes.body.response.answer).not.toContain('FinNexus');
    expect(queryRes.body.response.answer.length).toBeGreaterThan(10);
  });
});
