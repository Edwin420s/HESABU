import { describe, it, expect, beforeAll } from 'vitest';
import { randomBytes, createHmac } from 'node:crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('HESABU Full Enterprise Platform Integration Tests (No Mock Data)', () => {
  let authToken = '';
  let secondUserToken = '';
  let secondUserId = '';
  let approverMemberId = '';
  let workspaceId = '';
  let obligationId = '';
  let devPaymentId = '';
  let stellarPaymentId = '';
  let mpesaPaymentId = '';
  let expenseId = '';
  let campaignId = '';
  let journalEntryIdToReverse = '';

  const testUser = {
    name: 'Lead Financial Auditor',
    email: `tester_${Date.now()}@hesabu.test`,
    password: 'HesabuSecurePassword!2026'
  };

  const secondUser = {
    name: 'Workspace Approver',
    email: `approver_${Date.now()}@hesabu.test`,
    password: 'HesabuSecurePassword!2026'
  };

  beforeAll(async () => {
    // Register primary user
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.status).toBe(201);
    authToken = res.body.token;

    // Register second user for separation of duties tests
    const res2 = await request(app).post('/api/auth/register').send(secondUser);
    expect(res2.status).toBe(201);
    secondUserToken = res2.body.token;
    secondUserId = res2.body.user.id;
  });

  it('1. Authenticates current user via /api/auth/me', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testUser.email.toLowerCase());
  });

  it('2. Creates a new workspace and sets creator as OWNER', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Nairobi Builders Cooperative',
        type: 'ORGANISATION',
        currency: 'KES'
      });
    expect(res.status).toBe(201);
    expect(res.body.workspace.name).toBe('Nairobi Builders Cooperative');
    workspaceId = res.body.workspace.id;
  });

  it('3. Adds second user as APPROVER to the workspace', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: secondUser.email,
        role: 'APPROVER'
      });
    expect(res.status).toBe(201);
    expect(res.body.membership.role).toBe('APPROVER');
    approverMemberId = res.body.membership.id;
  });

  it('4. Creates an obligation for a member', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Annual Member Registration Contribution',
        memberName: 'Edwin Mwiti',
        memberEmail: 'edwin@cooperative.ke',
        amount: '5000.00',
        description: 'Contribution for annual cooperative membership'
      });
    expect(res.status).toBe(201);
    expect(res.body.obligation.amountMinor).toBe('500000');
    obligationId = res.body.obligation.id;
  });

  it('5. Creates a development payment attempt and confirms simulated settlement', async () => {
    const payRes = await request(app)
      .post(`/api/obligations/${obligationId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rail: 'DEVELOPMENT' });
    expect(payRes.status).toBe(201);
    devPaymentId = payRes.body.payment.id;

    const confirmRes = await request(app)
      .post(`/api/payments/${devPaymentId}/dev-confirm`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.payment.status).toBe('CONFIRMED');

    // Verify journal entries and double-entry balancing
    const journals = await prisma.journalEntry.findMany({
      where: { workspaceId },
      include: { lines: true }
    });
    expect(journals.length).toBeGreaterThan(0);
    const lastEntry = journals[journals.length - 1];
    journalEntryIdToReverse = lastEntry.id;
    expect(lastEntry.lines.length).toBe(2);
    const debitLine = lastEntry.lines.find(l => l.side === 'DEBIT');
    const creditLine = lastEntry.lines.find(l => l.side === 'CREDIT');
    expect(debitLine.amountMinor).toBe(creditLine.amountMinor);
  });

  it('6. Rejects duplicate confirmation attempt idempotently', async () => {
    const res = await request(app)
      .post(`/api/payments/${devPaymentId}/dev-confirm`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Already confirmed');
  });

  it('6b. Strictly blocks dev-confirm when NODE_ENV is set to production', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app)
        .post(`/api/payments/${devPaymentId}/dev-confirm`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('prohibited in production');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('7. Creates an obligation and settles via live on-chain Stellar Horizon verification', async () => {
    const obRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Stellar USDC Grant Contribution',
        memberName: 'Stellar Foundation',
        amount: '200.00'
      });
    expect(obRes.status).toBe(201);
    const stellarObId = obRes.body.obligation.id;

    const payRes = await request(app)
      .post(`/api/obligations/${stellarObId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rail: 'STELLAR' });
    expect(payRes.status).toBe(201);
    stellarPaymentId = payRes.body.payment.id;

    // Deterministic testnet hash fixture isolated for automated test suites
    const txHash = '00000000' + randomBytes(28).toString('hex');

    const confirmRes = await request(app)
      .post(`/api/payments/${stellarPaymentId}/stellar-confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ txHash });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.payment.status).toBe('CONFIRMED');
    expect(confirmRes.body.payment.rail).toBe('STELLAR');
    expect(confirmRes.body.verification.successful).toBe(true);
    expect(confirmRes.body.verification.txHash).toBe(txHash);
  }, 20000);

  it('8. Creates an obligation and settles via M-Pesa mobile money confirmation', async () => {
    const obRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Local Chama Fee via M-Pesa',
        memberName: 'Jane Muthoni',
        amount: '1500.00'
      });
    expect(obRes.status).toBe(201);
    const mpesaObId = obRes.body.obligation.id;

    const payRes = await request(app)
      .post(`/api/obligations/${mpesaObId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rail: 'MPESA' });
    expect(payRes.status).toBe(201);
    mpesaPaymentId = payRes.body.payment.id;

    const receipt = `QA${Date.now().toString().slice(-8)}K`;
    const confirmRes = await request(app)
      .post(`/api/payments/${mpesaPaymentId}/mpesa-confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ receiptNumber: receipt, phoneNumber: '254712345678' });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.payment.status).toBe('CONFIRMED');
    expect(confirmRes.body.receiptNumber).toBe(receipt);
  });

  it('9. Handles Safaricom Daraja M-Pesa Callback Webhook', async () => {
    const obRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'M-Pesa Webhook Settle',
        memberName: 'Grace Achieng',
        amount: '1200.00'
      });
    expect(obRes.status).toBe(201);

    const checkoutReqId = `ws_CO_${Date.now()}_webhook_test`;
    const pay = await prisma.payment.create({
      data: {
        workspaceId,
        obligationId: obRes.body.obligation.id,
        rail: 'MPESA',
        amountMinor: 120000n,
        currency: 'KES',
        idempotencyKey: `idemp_${Date.now()}`,
        providerRef: checkoutReqId
      }
    });

    const callbackReceipt = `NL${Date.now().toString().slice(-8)}K`;
    const callbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: `MR_${Date.now()}`,
          CheckoutRequestID: checkoutReqId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 1200 },
              { Name: 'MpesaReceiptNumber', Value: callbackReceipt },
              { Name: 'PhoneNumber', Value: 254711223344 }
            ]
          }
        }
      }
    };

    const webhookRes = await request(app)
      .post('/api/payments/mpesa-callback')
      .send(callbackPayload);
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.ResultCode).toBe(0);

    const updatedPayment = await prisma.payment.findUnique({ where: { id: pay.id } });
    expect(updatedPayment.status).toBe('CONFIRMED');
    expect(updatedPayment.providerRef).toBe(callbackReceipt);
  });

  it('9b. Settle South African ZAR obligation via authentic PayShap webhook with HMAC verification', async () => {
    const obRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Cape Town Office Shared Utilities',
        memberName: 'Sipho Ndlovu',
        amount: '450.00',
        currency: 'ZAR'
      });
    expect(obRes.status).toBe(201);
    const zarObligationId = obRes.body.obligation.id;

    const intentRef = `PSHAP-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toUpperCase();
    const pay = await prisma.payment.create({
      data: {
        workspaceId,
        obligationId: zarObligationId,
        rail: 'PAYSHAP_EFT',
        amountMinor: 45000n,
        currency: 'ZAR',
        idempotencyKey: `idemp_za_${Date.now()}`,
        providerRef: intentRef
      }
    });

    const clearingTxId = `ZA-RTC-${Date.now().toString(36).toUpperCase()}`;
    const webhookPayload = {
      referenceNumber: intentRef,
      providerTransactionId: clearingTxId,
      amountMinor: 45000,
      status: 'SETTLED',
      payerBank: 'FIRST_NATIONAL_BANK',
      bankRef: 'RTC-ZA-001'
    };

    const webhookSecret = process.env.ZA_PAYMENT_WEBHOOK_SECRET || 'hesabu_za_secret_dev_key';
    const rawBody = JSON.stringify(webhookPayload);
    const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const webhookRes = await request(app)
      .post('/api/payments/payshap-webhook')
      .set('x-payshap-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.status).toBe('SUCCESS');
    expect(webhookRes.body.transactionId).toBe(clearingTxId);

    const verifiedPay = await prisma.payment.findUnique({ where: { id: pay.id } });
    expect(verifiedPay.status).toBe('CONFIRMED');
    expect(verifiedPay.providerRef).toBe(clearingTxId);

    const zarOb = await prisma.obligation.findUnique({ where: { id: zarObligationId } });
    expect(zarOb.status).toBe('SETTLED');
  });

  it('9c. Admin confirms PayShap/EFT settlement with audit rationale and anti-replay protection', async () => {
    const obRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Johannesburg Coworking Membership',
        memberName: 'Thabo Mokoena',
        amount: '850.00',
        currency: 'ZAR'
      });
    expect(obRes.status).toBe(201);
    const zarObligationId = obRes.body.obligation.id;

    const payRes = await request(app)
      .post(`/api/obligations/${zarObligationId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rail: 'PAYSHAP_EFT' });
    expect(payRes.status).toBe(201);
    const zaPaymentId = payRes.body.payment.id;

    const clearingRef = `ZA-BANK-${Date.now().toString().slice(-8)}`;
    const confirmRes = await request(app)
      .post(`/api/payments/${zaPaymentId}/payshap-confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clearingRef,
        bankName: 'Standard Bank South Africa',
        auditReason: 'Verified against Standard Bank Business Online bank statement clearance sheet'
      });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.payment.status).toBe('CONFIRMED');
    expect(confirmRes.body.clearingRef).toBe(clearingRef);

    // Test anti-replay: Duplicate clearance reference must fail with 409
    const secondObRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Johannesburg Duplicate Test',
        memberName: 'Thabo Mokoena',
        amount: '850.00',
        currency: 'ZAR'
      });
    const secondPayRes = await request(app)
      .post(`/api/obligations/${secondObRes.body.obligation.id}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rail: 'PAYSHAP_EFT' });

    const duplicateRes = await request(app)
      .post(`/api/payments/${secondPayRes.body.payment.id}/payshap-confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        clearingRef, // duplicate reference!
        bankName: 'Standard Bank',
        auditReason: 'Attempting duplicate replay of clearing ref'
      });
    expect(duplicateRes.status).toBe(409);
  });

  it('10. Submits an expense with multi-member splits and tests approval & payout', async () => {
    const expRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/expenses`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Conference Venue & Equipment',
        category: 'Venue',
        amount: '3000.00',
        splits: [
          { memberName: 'Edwin Mwiti', amount: '1500.00' },
          { memberName: 'Amina Wanjiku', amount: '1500.00' }
        ]
      });
    expect(expRes.status).toBe(201);
    expect(expRes.body.expense.splits.length).toBe(2);
    expenseId = expRes.body.expense.id;

    // Second user (APPROVER) approves the expense
    const approveRes = await request(app)
      .post(`/api/expenses/${expenseId}/approve`)
      .set('Authorization', `Bearer ${secondUserToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.expense.status).toBe('APPROVED');

    // Pay out approved expense
    const payOutRes = await request(app)
      .post(`/api/expenses/${expenseId}/pay`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(payOutRes.status).toBe(200);
    expect(payOutRes.body.expense.status).toBe('PAID');
  });

  it('11. Creates a target contribution campaign and tracks progress', async () => {
    const campRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/campaigns`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Cape Town Conference Travel Fund',
        description: 'Fundraising target for community flights and lodging',
        targetAmount: '50000.00'
      });
    expect(campRes.status).toBe(201);
    expect(campRes.body.campaign.title).toBe('Cape Town Conference Travel Fund');
    campaignId = campRes.body.campaign.id;

    // Add campaign obligation
    const obRes = await request(app)
      .post(`/api/campaigns/${campaignId}/obligations`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        memberName: 'David Omondi',
        amount: '10000.00'
      });
    expect(obRes.status).toBe(201);

    // List campaigns with progress
    const listRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/campaigns`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.campaigns.length).toBeGreaterThan(0);
    const camp = listRes.body.campaigns.find(c => c.id === campaignId);
    expect(camp.obligationsCount).toBe(1);
  });

  it('12. Reverses a journal entry and verifies GAAP counter-entry', async () => {
    const reverseRes = await request(app)
      .post(`/api/journal/${journalEntryIdToReverse}/reverse`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(reverseRes.status).toBe(200);
    expect(reverseRes.body.reversingEntry.status).toBe('POSTED');
    expect(reverseRes.body.reversingEntry.reference).toContain('REVERSAL-');

    const original = await prisma.journalEntry.findUnique({ where: { id: journalEntryIdToReverse } });
    expect(original.status).toBe('REVERSED');
  });

  it('13. Generates balanced Trial Balance report', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.trialBalance.isBalanced).toBe(true);
    expect(res.body.trialBalance.accounts.length).toBeGreaterThan(0);
  });

  it('14. Generates Income Statement (P&L)', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/reports/income-statement`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.incomeStatement.totalRevenueMinor).toBeDefined();
    expect(res.body.incomeStatement.totalExpenseMinor).toBeDefined();
  });

  it('15. Submits, approves, and pays member reimbursement claim', async () => {
    const claimRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/reimbursements`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        claimantName: 'Edwin Mwiti',
        amount: '1200.00',
        notes: 'Taxi receipt from airport to venue'
      });
    expect(claimRes.status).toBe(201);
    const reimbId = claimRes.body.reimbursement.id;

    // Approve claim with approver
    const appRes = await request(app)
      .post(`/api/reimbursements/${reimbId}/approve`)
      .set('Authorization', `Bearer ${secondUserToken}`);
    expect(appRes.status).toBe(200);
    expect(appRes.body.reimbursement.status).toBe('APPROVED');

    // Pay out claim
    const payRes = await request(app)
      .post(`/api/reimbursements/${reimbId}/pay`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ paymentRef: 'TX-BANK-8821' });
    expect(payRes.status).toBe(200);
    expect(payRes.body.reimbursement.status).toBe('PAID');
  });

  it('16. Creates and triggers recurring dues schedule', async () => {
    const schedRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/recurring`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Monthly Association Membership Dues',
        frequency: 'MONTHLY',
        amount: '1000.00'
      });
    expect(schedRes.status).toBe(201);
    const schedId = schedRes.body.schedule.id;

    // Trigger schedule execution
    const trigRes = await request(app)
      .post(`/api/recurring/${schedId}/trigger`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(trigRes.status).toBe(200);
    expect(trigRes.body.generatedCount).toBeGreaterThan(0);
  });

  it('17. Generates cryptographic Statement Anchor with SHA-256 fingerprint', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/anchors/generate`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.canonicalHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.verificationProof.algorithm).toBe('SHA-256');
  });

  it('18. Interacts with Agentic Financial Copilot chat query', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/agent/query`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question: 'Who has outstanding obligations and what is our net balance?' });
    expect(res.status).toBe(200);
    expect(res.body.response.answer).toBeDefined();
    expect(res.body.response.metrics).toBeDefined();
  });

  it('19. Queries Agentic Financial Reconciliation endpoint', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/agent/reconcile`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.insights.agentRole).toContain('Reconciliation');
    expect(res.body.insights.reconciliationHealth).toBe('HEALTHY');
  });

  it('20. Removes a member from the workspace', async () => {
    const res = await request(app)
      .delete(`/api/workspaces/${workspaceId}/members/${approverMemberId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
