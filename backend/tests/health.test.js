import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { money, formatCurrencyDisplay } from '../src/shared/money.js';
import { generateReceiptVoucher, generatePaymentReceipt } from '../src/modules/reports/receiptGenerator.js';

describe('health endpoint and module exports', () => {
  it('returns service health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('exports money and formats currency display cleanly without precision loss', () => {
    expect(typeof money).toBe('function');
    expect(money('125000', 'KES')).toBe('KSh 1,250.00');
    expect(formatCurrencyDisplay(1000000n, 'USD')).toBe('$ 10,000.00');
  });

  it('generates compliant receipt vouchers via both export signatures', () => {
    const voucher = generateReceiptVoucher({
      paymentId: 'pay_test_12345678',
      amountMinor: 50000,
      currency: 'KES',
      method: 'MPESA',
      status: 'CONFIRMED',
      workspaceName: 'Acme Chama'
    });
    expect(voucher.receiptNumber).toBe('RCP-PAY_TEST');
    expect(voucher.financials.amountFormatted).toBe('KSh 500.00');
    expect(voucher.verificationProof.isVerified).toBe(true);
  });
});
