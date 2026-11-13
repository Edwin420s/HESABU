import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Comprehensive End-to-End Frontend Modules & Workflows Suite', () => {
  let token = '';
  let secondUserToken = '';
  let secondUserId = '';
  let secondUserMemberId = '';
  let workspaceId = '';
  let ownerUserId = '';
  let ownerMemberId = '';
  let testObligationId = '';
  let testPaymentId = '';
  let testExpenseId = '';
  let testJournalId = '';
  let testRoscaId = '';
  let testLoanId = '';
  let testInvoiceId = '';
  let testBillId = '';
  let testPurchaseRequestId = '';

  beforeAll(async () => {
    // 1. Register Primary Workspace Admin
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'E2E Operations Director',
      email: `e2e_director_${Date.now()}@hesabu.test`,
      password: 'HesabuE2EPassword!2026'
    });
    expect(regRes.status).toBe(201);
    token = regRes.body.token;
    ownerUserId = regRes.body.user.id;

    // 2. Register Secondary Approver / Member
    const secRes = await request(app).post('/api/auth/register').send({
      name: 'E2E Approver & Member',
      email: `e2e_approver_${Date.now()}@hesabu.test`,
      password: 'HesabuE2EPassword!2026'
    });
    expect(secRes.status).toBe(201);
    secondUserToken = secRes.body.token;
    secondUserId = secRes.body.user.id;

    // 3. Create Enterprise Workspace
    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Hesabu Comprehensive Enterprise Hub',
        type: 'SME',
        profile: 'BUSINESS',
        country: 'KE',
        currency: 'KES'
      });
    expect(wsRes.status).toBe(201);
    workspaceId = wsRes.body.workspace.id;

    // Fetch owner membership
    const ownerWs = await prisma.membership.findFirst({
      where: { workspaceId, userId: ownerUserId }
    });
    ownerMemberId = ownerWs.id;

    // Add secondary user to workspace as APPROVER
    const addMemRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: secRes.body.user.email,
        role: 'APPROVER'
      });
    expect(addMemRes.status).toBe(201);

    const secWs = await prisma.membership.findFirst({
      where: { workspaceId, userId: secondUserId }
    });
    secondUserMemberId = secWs.id;
  });

  // 1. Overview
  it('1. OVERVIEW: queries dashboard metrics and collaborative health score', async () => {
    const dashRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/dashboard`)
      .set('Authorization', `Bearer ${token}`);
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.summary).toBeDefined();
    expect(dashRes.body.summary.obligationsMinor).toBeDefined();
    expect(dashRes.body.summary.receivedMinor).toBeDefined();

    const healthRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/analytics/health-score`)
      .set('Authorization', `Bearer ${token}`);
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.healthScore).toBeGreaterThanOrEqual(0);
    expect(healthRes.body.rating).toBeDefined();
  });

  // 2. Contributions
  it('2. CONTRIBUTIONS: creates an obligation and verifies listing', async () => {
    const obRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Quarterly Infrastructure Reserve Contribution',
        memberName: 'E2E Approver & Member',
        amount: '25000.00',
        currency: 'KES',
        dueAt: new Date(Date.now() + 14 * 86400000).toISOString()
      });
    expect(obRes.status).toBe(201);
    expect(obRes.body.obligation.title).toBe('Quarterly Infrastructure Reserve Contribution');
    testObligationId = obRes.body.obligation.id;

    const listRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/obligations`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.obligations.length).toBeGreaterThan(0);
    const found = listRes.body.obligations.find(o => o.id === testObligationId);
    expect(found).toBeDefined();
  });

  // 3. Invoices & AR
  it('3. INVOICES & AR: registers customer, issues invoice, settles and issues credit note', async () => {
    const custRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/customers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Apex Strategic Partners Ltd',
        email: `apex_${Date.now()}@apexcorp.test`,
        phone: '+254700112233',
        taxId: 'P051234567Z',
        address: 'Westlands Commercial Tower, Nairobi'
      });
    expect(custRes.status).toBe(201);
    const customerId = custRes.body.customer.id;

    const invRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        invoiceNumber: `INV-E2E-${Date.now().toString().slice(-6)}`,
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        lines: [
          { description: 'Cloud Financial Architecture Advisory', quantity: 2, unitPrice: '15000' },
          { description: 'Security & Audit Verification Sprint', quantity: 1, unitPrice: '20000' }
        ]
      });
    expect(invRes.status).toBe(201);
    testInvoiceId = invRes.body.invoice.id;
    expect(invRes.body.invoice.subtotalMinor).toBe(5000000n.toString());

    // Settle invoice partially
    const settleRes = await request(app)
      .post(`/api/invoices/${testInvoiceId}/settle`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: '20000.00',
        paymentRail: 'DEVELOPMENT',
        paymentRef: `SETTLE-INV-${Date.now()}`
      });
    expect(settleRes.status).toBe(200);
    expect(settleRes.body.invoice.status).toBe('PARTIALLY_PAID');

    // Issue Credit Note
    const cnRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/invoices/${testInvoiceId}/credit-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        reason: 'Commercial volume discount concession',
        lines: [
          { description: 'Concession', quantity: 1, unitPrice: '5000' }
        ]
      });
    expect(cnRes.status).toBe(201);
    expect(cnRes.body.creditNote.reason).toBe('Commercial volume discount concession');
  });

  // 4. Bills & AP
  it('4. BILLS & AP: registers supplier, creates bill, approves, and executes payment', async () => {
    const supRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/suppliers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sovereign Telecommunications East Africa',
        email: `billing_${Date.now()}@sovereign-tel.test`,
        phone: '+254711998877',
        bankName: 'KCB Bank Kenya',
        bankAccount: '1299482103',
        taxId: 'P059918231K'
      });
    expect(supRes.status).toBe(201);
    const supplierId = supRes.body.supplier.id;

    const billRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/bills`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId,
        billNumber: `BILL-TEL-${Date.now().toString().slice(-6)}`,
        amount: '8500.00',
        category: 'OPERATING',
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        notes: 'Monthly enterprise high-speed dedicated uplink'
      });
    expect(billRes.status).toBe(201);
    testBillId = billRes.body.bill.id;
    expect(billRes.body.bill.status).toBe('PENDING_APPROVAL');

    // Approve bill
    const approveRes = await request(app)
      .post(`/api/bills/${testBillId}/approve`)
      .set('Authorization', `Bearer ${secondUserToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.bill.status).toBe('APPROVED');

    // Pay bill
    const payRes = await request(app)
      .post(`/api/bills/${testBillId}/pay`)
      .set('Authorization', `Bearer ${token}`);
    expect(payRes.status).toBe(200);
    expect(payRes.body.bill.status).toBe('PAID');
    expect(payRes.body.notice).toBeDefined();
  });

  // 5. Procurement
  it('5. PROCUREMENT: submits purchase request and reviews decision', async () => {
    const prRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/purchase-requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Hardware Security Key Hardware Bundles (FIDO2)',
        description: 'Multi-factor authentication enforcement for treasury signatories',
        amount: '12000.00',
        department: 'IT_INFRA'
      });
    expect(prRes.status).toBe(201);
    testPurchaseRequestId = prRes.body.request.id;

    const listRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/purchase-requests`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.requests.length).toBeGreaterThan(0);

    const reviewRes = await request(app)
      .post(`/api/purchase-requests/${testPurchaseRequestId}/review`)
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        decision: 'APPROVED',
        note: 'Approved under Q4 Cybersecurity procurement allocation'
      });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.request.status).toBe('APPROVED');
  });

  // 6. Campaigns & Goals
  it('6. CAMPAIGNS & GOALS: creates campaign and adds target obligations', async () => {
    const campRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/campaigns`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Q4 Regional Innovation Forum Sponsoring Fund',
        description: 'Collective fundraising to sponsor 5 community developers to Cape Town',
        targetAmount: '150000.00'
      });
    expect(campRes.status).toBe(201);
    const campId = campRes.body.campaign.id;

    const campOblRes = await request(app)
      .post(`/api/campaigns/${campId}/obligations`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        memberName: 'Amina Wanjiku',
        amount: '30000.00'
      });
    expect(campOblRes.status).toBe(201);

    const getCampRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/campaigns`)
      .set('Authorization', `Bearer ${token}`);
    expect(getCampRes.status).toBe(200);
    const foundCamp = getCampRes.body.campaigns.find(c => c.id === campId);
    expect(foundCamp).toBeDefined();
    expect(foundCamp.obligationsCount).toBe(1);
  });

  // 7. Expenses & Splits
  it('7. EXPENSES & SPLITS: submits split expense, approves with separation of duties, and pays out', async () => {
    const expRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Executive Strategic Planning Retreat Facility',
        category: 'Venue',
        amount: '6000.00',
        splits: [
          { memberName: 'E2E Operations Director', amount: '3000.00' },
          { memberName: 'E2E Approver & Member', amount: '3000.00' }
        ]
      });
    expect(expRes.status).toBe(201);
    testExpenseId = expRes.body.expense.id;

    // Secondary user approves (separation of duties)
    const approveExpRes = await request(app)
      .post(`/api/expenses/${testExpenseId}/approve`)
      .set('Authorization', `Bearer ${secondUserToken}`);
    expect(approveExpRes.status).toBe(200);
    expect(approveExpRes.body.expense.status).toBe('APPROVED');

    // Pay out expense
    const payExpRes = await request(app)
      .post(`/api/expenses/${testExpenseId}/pay`)
      .set('Authorization', `Bearer ${token}`);
    expect(payExpRes.status).toBe(200);
    expect(payExpRes.body.expense.status).toBe('PAID');
    testJournalId = payExpRes.body.journalEntryId;
  });

  // 8. Reimbursements
  it('8. REIMBURSEMENTS: submits claim, approves, and settles with payment reference', async () => {
    const reimbRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/reimbursements`)
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        claimantName: 'E2E Approver & Member',
        amount: '4500.00',
        category: 'Transport',
        notes: 'Emergency client site visit cab fare and toll receipts'
      });
    expect(reimbRes.status).toBe(201);
    const reimbId = reimbRes.body.reimbursement.id;

    // Admin approves claim
    const appReimbRes = await request(app)
      .post(`/api/reimbursements/${reimbId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(appReimbRes.status).toBe(200);
    expect(appReimbRes.body.reimbursement.status).toBe('APPROVED');

    // Admin pays claim
    const payReimbRes = await request(app)
      .post(`/api/reimbursements/${reimbId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentRef: `TX-BANK-${Date.now().toString().slice(-6)}` });
    expect(payReimbRes.status).toBe(200);
    expect(payReimbRes.body.reimbursement.status).toBe('PAID');
  });

  // 9. Recurring Dues
  it('9. RECURRING DUES: configures schedule and triggers automatic member obligations generation', async () => {
    const schedRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/recurring`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Monthly Association Operations Dues',
        frequency: 'MONTHLY',
        amount: '2000.00'
      });
    expect(schedRes.status).toBe(201);
    const schedId = schedRes.body.schedule.id;

    const listRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/recurring`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.schedules.length).toBeGreaterThan(0);

    const triggerRes = await request(app)
      .post(`/api/recurring/${schedId}/trigger`)
      .set('Authorization', `Bearer ${token}`);
    expect(triggerRes.status).toBe(200);
    expect(triggerRes.body.generatedCount).toBeGreaterThan(0);
  });

  // 10. Merry-Go-Round (ROSCA)
  it('10. MERRY-GO-ROUND: creates rotating savings circle, contributes and rotates pot', async () => {
    const roscaRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/rosca`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Executive Leadership Merry-Go-Round 2026',
        contributionPerMemberMinor: 1000000, // 10,000 KES
        frequencyDays: 30,
        memberIds: [ownerMemberId, secondUserMemberId]
      });
    expect(roscaRes.status).toBe(201);
    testRoscaId = roscaRes.body.id;
    expect(roscaRes.body.totalRounds).toBe(2);

    // Both members contribute into current round pot
    const contribRes1 = await request(app)
      .post(`/api/rosca/${testRoscaId}/contribute`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        memberId: ownerMemberId,
        amountMinor: 1000000
      });
    expect(contribRes1.status).toBe(200);
    expect(contribRes1.body.amountContributedMinor).toBe(1000000);

    const contribRes2 = await request(app)
      .post(`/api/rosca/${testRoscaId}/contribute`)
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        memberId: secondUserMemberId,
        amountMinor: 1000000
      });
    expect(contribRes2.status).toBe(200);
    expect(contribRes2.body.isPotFullyFunded).toBe(true);

    // Disburse round 1 pot and rotate to round 2
    const disburseRes = await request(app)
      .post(`/api/rosca/${testRoscaId}/payout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roundNumber: 1 });
    expect(disburseRes.status).toBe(200);
    expect(disburseRes.body.nextRound).toBe(2);
  });

  // 11. Table Loans
  it('11. TABLE LOANS: applies for loan, approves, disburses, and executes repayment without overpayment', async () => {
    const applyRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/loans/apply`)
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        principalMinor: 2000000, // 20,000 KES
        interestRatePct: 12,
        durationMonths: 6,
        interestType: 'FLAT',
        borrowerName: 'E2E Approver & Member'
      });
    expect(applyRes.status).toBe(201);
    testLoanId = applyRes.body.id;

    // Admin approves loan
    const appLoanRes = await request(app)
      .post(`/api/loans/${testLoanId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(appLoanRes.status).toBe(200);
    expect(appLoanRes.body.status).toBe('APPROVED');

    // Admin disburses loan
    const disburseLoanRes = await request(app)
      .post(`/api/loans/${testLoanId}/disburse`)
      .set('Authorization', `Bearer ${token}`);
    expect(disburseLoanRes.status).toBe(200);
    expect(disburseLoanRes.body.status).toBe('DISBURSED');

    // Partial Repayment
    const repayRes = await request(app)
      .post(`/api/loans/${testLoanId}/repay`)
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        amountMinor: 1000000,
        transactionRef: `SETTLE-LOAN-${Date.now()}`
      });
    expect(repayRes.status).toBe(200);
    expect(repayRes.body.totalRepaidMinor).toBe(1000000);

    // Overpayment attempt strictly throws 400
    const overpayRes = await request(app)
      .post(`/api/loans/${testLoanId}/repay`)
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        amountMinor: 50000000,
        transactionRef: `EXCESS-${Date.now()}`
      });
    expect(overpayRes.status).toBe(400);
  });

  // 12. Budget Variance
  it('12. BUDGET VARIANCE: configures category budget and retrieves live utilization variance', async () => {
    const budgetRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/budgets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'Venue',
        period: 'MONTHLY',
        allocatedMinor: 2000000 // 20,000 KES
      });
    expect(budgetRes.status).toBe(201);

    const varRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/budgets/variance`)
      .set('Authorization', `Bearer ${token}`);
    expect(varRes.status).toBe(200);
    expect(varRes.body.categories).toBeDefined();
    expect(varRes.body.totalAllocatedMinor).toBeDefined();
    expect(varRes.body.overallUtilizationPct).toBeDefined();
  });

  // 13. FX & Treasury
  it('13. FX & TREASURY: queries multi-currency rates, converts with spread, and executes persistent quote', async () => {
    const ratesRes = await request(app)
      .get('/api/fx/rates')
      .set('Authorization', `Bearer ${token}`);
    expect(ratesRes.status).toBe(200);
    expect(ratesRes.body.rates.KES).toBeDefined();
    expect(ratesRes.body.rates.ZAR).toBeDefined();

    const convertRes = await request(app)
      .post('/api/fx/convert')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountMinor: 500000,
        fromCurrency: 'USD',
        toCurrency: 'KES',
        spreadPercentage: 0.005
      });
    expect(convertRes.status).toBe(200);
    expect(convertRes.body.targetAmountMinor).toBeGreaterThan(0);

    // Create persistent quote & execute
    const quoteRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/fx/quote`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromCurrency: 'USD',
        toCurrency: 'KES',
        amountMinor: 10000
      });
    expect(quoteRes.status).toBe(201);
    const quoteRef = quoteRes.body.quoteRef;

    const execRes = await request(app)
      .post(`/api/fx/quotes/${quoteRef}/execute`)
      .set('Authorization', `Bearer ${token}`);
    expect(execRes.status).toBe(200);
    expect(execRes.body.targetAmountMinor).toBeDefined();
  });

  // 14. Payments & Rails
  it('14. PAYMENTS & RAILS: creates payment attempt, confirms settlement, and fetches receipt voucher', async () => {
    const payRes = await request(app)
      .post(`/api/obligations/${testObligationId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rail: 'DEVELOPMENT',
        amountMinor: 2500000
      });
    expect(payRes.status).toBe(201);
    testPaymentId = payRes.body.payment.id;
    expect(payRes.body.payment.status).toBe('PENDING');

    // Confirm settlement
    const confRes = await request(app)
      .post(`/api/payments/${testPaymentId}/dev-confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confRes.status).toBe(200);
    expect(confRes.body.payment.status).toBe('CONFIRMED');

    // Fetch official voucher
    const voucherRes = await request(app)
      .get(`/api/payments/${testPaymentId}/voucher`)
      .set('Authorization', `Bearer ${token}`);
    expect(voucherRes.status).toBe(200);
    expect(voucherRes.body.receiptNumber).toBeDefined();
    expect(voucherRes.body.financials.amountMinor).toBe('2500000');
  });

  // 15. Agentic Copilot
  it('15. AGENTIC COPILOT: queries copilot analysis and checks reconciliation insights', async () => {
    const queryRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/agent/query`)
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is our current collection rate and outstanding balance?' });
    expect(queryRes.status).toBe(200);
    expect(queryRes.body.response.answer).toBeDefined();

    const reconRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/agent/reconcile`)
      .set('Authorization', `Bearer ${token}`);
    expect(reconRes.status).toBe(200);
    expect(reconRes.body.insights.reconciliationHealth).toBeDefined();
  });

  // 16. Double-Entry Ledger
  it('16. DOUBLE-ENTRY LEDGER: queries balanced entries and posts GAAP contra-reversal', async () => {
    const journalRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/journal`)
      .set('Authorization', `Bearer ${token}`);
    expect(journalRes.status).toBe(200);
    expect(journalRes.body.entries.length).toBeGreaterThan(0);

    const activeEntry = journalRes.body.entries.find(e => e.status === 'POSTED');
    expect(activeEntry).toBeDefined();

    // Reverse previously posted journal entry
    const revRes = await request(app)
      .post(`/api/journal/${activeEntry.id}/reverse`)
      .set('Authorization', `Bearer ${token}`);
    expect(revRes.status).toBe(200);
    expect(revRes.body.reversingEntry.status).toBe('POSTED');
  });

  // 17. Financial Statements & Anchors
  it('17. FINANCIAL STATEMENTS & ANCHORS: verifies Trial Balance, P&L, generates Merkle anchor and verifies proof', async () => {
    const tbRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/reports/trial-balance`)
      .set('Authorization', `Bearer ${token}`);
    expect(tbRes.status).toBe(200);
    expect(tbRes.body.isBalanced).toBe(true);

    const isRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/reports/income-statement`)
      .set('Authorization', `Bearer ${token}`);
    expect(isRes.status).toBe(200);
    expect(isRes.body.totalRevenueMinor).toBeDefined();

    // Generate cryptographic Statement Anchor (Merkle Root)
    const anchorRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/anchors/generate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(anchorRes.status).toBe(201);
    expect(anchorRes.body.canonicalHash).toMatch(/^[0-9a-f]{64}$/);
    const rootHash = anchorRes.body.canonicalHash;
    const anchorId = anchorRes.body.anchor.id;

    // Verify leaf inclusion proof
    const verifyProofRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/anchors/verify-leaf`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        rootHash,
        anchorId,
        leafHash: rootHash,
        proof: []
      });
    expect(verifyProofRes.status).toBe(200);
    expect(verifyProofRes.body.anchorRegistered).toBe(true);
  });

  // 18. Chart of Accounts Portfolio & Balances
  it('18. CHART OF ACCOUNTS: lists ledger accounts with live debit/credit balances and creates custom account', async () => {
    // List accounts with balances
    const listRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/accounts`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.accounts)).toBe(true);
    expect(listRes.body.accounts.length).toBeGreaterThan(0);
    const cashAccount = listRes.body.accounts.find(a => a.code === '1000-CASH-CLEARING' || a.code.startsWith('1000'));
    expect(cashAccount).toBeDefined();
    expect(cashAccount.debitsMinor).toBeDefined();
    expect(cashAccount.creditsMinor).toBeDefined();

    // Create a new custom GL account
    const createRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/accounts`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: '1099',
        name: 'Stellar Settlement Clearing Account',
        type: 'ASSET',
        description: 'Multi-rail transit account for XLM/EURC liquidity'
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.account.code).toBe('1099');
    expect(createRes.body.account.name).toBe('Stellar Settlement Clearing Account');
  });
});
