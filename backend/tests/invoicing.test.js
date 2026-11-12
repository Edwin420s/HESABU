import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Invoicing & Accounts Receivable (Layer 4 B2B)', () => {
  let token;
  let workspace;
  let customer;

  beforeAll(async () => {
    const email = `invoicing_tester_${Date.now()}@hesabu.africa`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Invoicing Tester',
        email,
        password: 'Password123!',
      });
    token = regRes.body.token;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'SME Consulting Ltd',
        type: 'ORGANISATION',
        currency: 'KES',
      });
    workspace = wsRes.body.workspace;
  });

  it('creates and lists B2B customers', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspace.id}/customers`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Nairobi Safaris Ltd',
        email: 'billing@nairobisafaris.co.ke',
        phone: '+254712345678',
        taxId: 'P051234567X',
        address: 'Westlands, Nairobi'
      });

    expect(res.status).toBe(201);
    expect(res.body.customer).toBeDefined();
    expect(res.body.customer.id).toBeDefined();
    expect(res.body.customer.name).toBe('Nairobi Safaris Ltd');
    customer = res.body.customer;

    const listRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/customers`)
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.customers.length).toBeGreaterThan(0);
  });

  it('creates an invoice with line items, VAT calculation, and settles it', async () => {
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString();
    const invRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        invoiceNumber: 'INV-KE-2026-001',
        dueDate,
        lines: [
          {
            description: 'Financial Advisory Services',
            quantity: 2,
            unitPrice: '10000.00' // 10,000 KES each => 20,000 KES (2,000,000 cents)
          },
          {
            description: 'Audit Preparation',
            quantity: 1,
            unitPrice: '5000.00' // 5,000 KES (500,000 cents)
          }
        ]
      });

    expect(invRes.status).toBe(201);
    const invoice = invRes.body.invoice;
    expect(invoice.subtotalMinor).toBe('2500000'); // 20k + 5k = 25,000 KES (2,500,000 cents)
    expect(invoice.taxMinor).toBe('400000'); // 16% of 25,000 = 4,000 KES (400,000 cents)
    expect(invoice.totalMinor).toBe('2900000'); // 29,000 KES (2,900,000 cents)
    expect(invoice.status).toBe('SENT');

    // Settle invoice -> posts Accounts Receivable settlement
    const settleRes = await request(app)
      .post(`/api/invoices/${invoice.id}/settle`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentRef: `MPESA-${Date.now().toString(36).toUpperCase()}`,
        rail: 'MPESA'
      });

    expect(settleRes.status).toBe(200);
    expect(settleRes.body.invoice.status).toBe('PAID');
  });
});
