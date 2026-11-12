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
    expect(settleRes.body.invoice.paidMinor).toBe('2900000');
  });

  it('supports partial settlement allocations and credit notes with exact accounting', async () => {
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString();
    const invRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: customer.id,
        invoiceNumber: `INV-PARTIAL-${Date.now().toString(36).toUpperCase()}`,
        dueDate,
        lines: [
          {
            description: 'Cloud Infrastructure Retainer',
            quantity: 1,
            unitPrice: '10000.00' // 10,000 KES (1,000,000 cents) -> VAT 16% = 160,000 -> Total = 1,160,000 cents
          }
        ]
      });

    expect(invRes.status).toBe(201);
    const invoice = invRes.body.invoice;
    expect(invoice.totalMinor).toBe('1160000');
    expect(invoice.status).toBe('SENT');

    // Partial settlement: pay 5,000 KES (500,000 cents)
    const partialRes = await request(app)
      .post(`/api/invoices/${invoice.id}/settle`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentRef: `EFT-${Date.now().toString(36).toUpperCase()}`,
        rail: 'PAYSHAP_EFT',
        amount: '5000.00'
      });

    expect(partialRes.status).toBe(200);
    expect(partialRes.body.invoice.status).toBe('PARTIALLY_PAID');
    expect(partialRes.body.invoice.paidMinor).toBe('500000');

    // Attempting to overpay beyond remaining balance (6,600 KES) must fail
    const overpayRes = await request(app)
      .post(`/api/invoices/${invoice.id}/settle`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: '10000.00' // 10,000 > 6,600
      });
    expect(overpayRes.status).toBe(400);

    // Issue Credit Note for remaining balance (unit price 5,689.6552 + 16% VAT = 6,600 KES or 1 line item)
    // 5,689.66 KES (568,966 cents) + 16% (91,034 cents) = 660,000 cents
    const cnRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/invoices/${invoice.id}/credit-notes`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        reason: 'Service SLA outage goodwill rebate',
        lines: [
          {
            description: 'SLA Outage Credit',
            quantity: 1,
            unitPrice: '5689.65'
          }
        ]
      });

    expect(cnRes.status).toBe(201);
    expect(cnRes.body.creditNote.creditNoteNumber).toMatch(/^CN-/);
    expect(cnRes.body.creditNote.totalMinor).toBe('659999');

    // Fetch invoice with all relations (allocations, creditNotes)
    const getInvRes = await request(app)
      .get(`/api/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getInvRes.status).toBe(200);
    expect(getInvRes.body.invoice.allocations.length).toBeGreaterThan(0);
    expect(getInvRes.body.invoice.creditNotes.length).toBeGreaterThan(0);

    // List credit notes for workspace
    const listCnRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/credit-notes`)
      .set('Authorization', `Bearer ${token}`);

    expect(listCnRes.status).toBe(200);
    expect(listCnRes.body.creditNotes.length).toBeGreaterThan(0);
  });
});
