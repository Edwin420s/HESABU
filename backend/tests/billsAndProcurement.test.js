import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Supplier Bills & Procurement Workflows (Layer 4 AP)', () => {
  let token;
  let workspace;
  let supplier;

  beforeAll(async () => {
    const email = `ap_tester_${Date.now()}@hesabu.africa`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'AP Tester',
        email,
        password: 'Password123!',
      });
    token = regRes.body.token;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'FinNexus Cape Town SME',
        type: 'ORGANISATION',
        currency: 'ZAR',
      });
    workspace = wsRes.body.workspace;
  });

  it('manages suppliers and creates a supplier bill', async () => {
    const supRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/suppliers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cape Cloud Hosting Pty',
        email: 'accounts@capecloud.co.za',
        phone: '+27215551234',
        bankName: 'Standard Bank',
        bankAccount: '123456789',
        taxId: 'ZA4918239102',
        address: 'Cape Town, Foreshore'
      });

    expect(supRes.status).toBe(201);
    expect(supRes.body.supplier).toBeDefined();
    supplier = supRes.body.supplier;

    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString();
    const billRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/bills`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplierId: supplier.id,
        billNumber: 'INV-CCH-2026-09',
        amount: '4500.00', // 4,500.00 ZAR
        dueDate,
        notes: 'Monthly AWS Cloud Hosting'
      });

    expect(billRes.status).toBe(201);
    expect(billRes.body.bill).toBeDefined();
    expect(billRes.body.bill.status).toBe('PENDING_APPROVAL');
    const billId = billRes.body.bill.id;

    // Approve bill
    const approveRes = await request(app)
      .post(`/api/bills/${billId}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.bill.status).toBe('APPROVED');

    // Pay bill -> posts Accounts Payable debit and Cash credit journal entries
    const payRes = await request(app)
      .post(`/api/bills/${billId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentRef: 'PAYSHAP-ZAR-8932741'
      });

    expect(payRes.status).toBe(200);
    expect(payRes.body.bill.status).toBe('PAID');
    expect(payRes.body.bill.updatedAt).toBeDefined();
  });

  it('handles procurement purchase requests and approval policies', async () => {
    const prRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/purchase-requests`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Office Ergonomic Chairs',
        description: 'Set of 4 ergonomic chairs for operations team',
        amount: '12000.00', // 12,000 ZAR
        department: 'OPERATIONS'
      });

    expect(prRes.status).toBe(201);
    expect(prRes.body.request).toBeDefined();
    const prId = prRes.body.request.id;
    expect(prRes.body.request.status).toBe('PENDING');

    // Review & approve purchase request
    const reviewRes = await request(app)
      .post(`/api/purchase-requests/${prId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        decision: 'APPROVED',
        note: 'Approved for operations team'
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.request.status).toBe('APPROVED');
  });
});
