import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { FxService } from '../src/modules/fx/fxService.js';

describe('Multi-Currency FX Service & Engine', () => {
  const fx = new FxService();

  it('provides supported currencies with their correct decimal precision', () => {
    const currencies = fx.getSupportedCurrencies();
    expect(currencies).toContain('KES');
    expect(currencies).toContain('USD');
    expect(currencies).toContain('EUR');
    expect(currencies).toContain('UGX');

    expect(fx.currencyDecimals.KES).toBe(2);
    expect(fx.currencyDecimals.USD).toBe(2);
    expect(fx.currencyDecimals.UGX).toBe(0);
  });

  it('calculates cross-rates accurately', () => {
    // 1 USD = 130 KES, 1 USD = 0.92 EUR
    const kesToUsd = fx.getExchangeRate('KES', 'USD');
    expect(kesToUsd).toBeCloseTo(1 / 130, 4);

    const eurToKes = fx.getExchangeRate('EUR', 'KES');
    // 130 / 0.92 = 141.3043
    expect(eurToKes).toBeCloseTo(141.3043, 2);
  });

  it('converts minor units safely between currencies with integer precision', () => {
    // Convert 100.00 USD (10,000 cents) to KES (minor units: cents)
    // 100 USD * 130 = 13,000 KES = 1,300,000 KES cents
    const result = fx.convert(10000, 'USD', 'KES', 0);
    expect(result.sourceAmountMinor).toBe(10000);
    expect(result.targetAmountMinor).toBe(1300000);
    expect(result.exchangeRate).toBe(130);
  });

  it('converts between currencies with different scale (e.g. KES cents to UGX whole)', () => {
    // 130 KES = 1 USD = 3700 UGX => 1 KES = 3700 / 130 = 28.4615 UGX
    // 1000 KES (100,000 KES cents) => 28,462 UGX (UGX has 0 decimals)
    const result = fx.convert(100000, 'KES', 'UGX', 0);
    expect(result.sourceAmountMinor).toBe(100000);
    expect(result.targetAmountMinor).toBe(28462);
  });

  it('applies spread deduction properly', () => {
    // 10,000 USD cents with 1% spread (0.01)
    const result = fx.convert(10000, 'USD', 'KES', 0.01);
    // 130 * 0.99 = 128.70 => 12,870 KES = 1,287,000 KES cents
    expect(result.targetAmountMinor).toBe(1287000);
    expect(result.spreadPercentage).toBe(0.01);
  });

  it('creates and retrieves time-locked quotes', () => {
    const quote = fx.createQuote(50000, 'EUR', 'KES', 0.005);
    expect(quote.quoteId).toMatch(/^fxq_/);
    expect(quote.targetAmountMinor).toBeGreaterThan(0);
    expect(quote.expiresAt).toBeDefined();

    const retrieved = fx.getQuote(quote.quoteId);
    expect(retrieved).not.toBeNull();
    expect(retrieved.quoteId).toBe(quote.quoteId);
  });

  it('exposes public FX rates over HTTP API', async () => {
    const res = await request(app).get('/api/fx/rates');
    expect(res.status).toBe(200);
    expect(res.body.base).toBe('USD');
    expect(res.body.rates.KES).toBeDefined();
    expect(res.body.rates.USD.rateToUsd).toBe(1);
  });

  it('converts minor amounts via HTTP API', async () => {
    const res = await request(app)
      .post('/api/fx/convert')
      .send({
        amountMinor: 260000, // 2,600 KES
        fromCurrency: 'KES',
        toCurrency: 'USD',
      });

    expect(res.status).toBe(200);
    // 2600 KES / 130 = 20 USD = 2000 USD cents
    expect(res.body.targetAmountMinor).toBe(2000);
  });

  it('creates persistent quote and executes with balanced multi-currency GAAP journal entry', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'FX Trader',
        email: `fxtrader_${Date.now()}@hesabu.test`,
        password: 'Password123!'
      });
    const token = regRes.body.token;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Regional Treasury Hub',
        type: 'ORGANISATION',
        currency: 'KES'
      });
    const workspaceId = wsRes.body.workspace.id;

    // Create persistent quote (100 USD = 10,000 cents to KES)
    const quoteRes = await request(app)
      .post(`/api/workspaces/${workspaceId}/fx/quote`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fromCurrency: 'USD',
        toCurrency: 'KES',
        amountMinor: 10000,
        spreadPercentage: 0.005,
        validityMinutes: 30
      });

    expect(quoteRes.status).toBe(201);
    const quote = quoteRes.body;
    expect(quote.quoteRef).toMatch(/^FXQ-USD-KES-/);
    expect(quote.status).toBe('ACTIVE');

    // Execute quote
    const execRes = await request(app)
      .post(`/api/fx/quotes/${quote.quoteRef}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        settlementRef: `SETTLE-${Date.now().toString(36).toUpperCase()}`
      });

    expect(execRes.status).toBe(200);
    expect(execRes.body.quoteId).toBe(quote.id);

    // Verify journal entry lines balance for each currency leg via 1040-FX-CLEARING
    const journalEntries = await prisma.journalEntry.findMany({
      where: { workspaceId },
      include: { lines: true }
    });
    expect(journalEntries.length).toBeGreaterThan(0);

    const fxEntry = journalEntries.find(j => j.reference.startsWith('JOURNAL-FX-'));
    expect(fxEntry).toBeDefined();
    expect(fxEntry.lines.length).toBe(4);

    // Filter USD lines
    const usdLines = fxEntry.lines.filter(l => l.currency === 'USD');
    const usdDebit = usdLines.filter(l => l.side === 'DEBIT').reduce((acc, l) => acc + l.amountMinor, 0n);
    const usdCredit = usdLines.filter(l => l.side === 'CREDIT').reduce((acc, l) => acc + l.amountMinor, 0n);
    expect(usdDebit).toBe(usdCredit); // USD leg balances!

    // Filter KES lines
    const kesLines = fxEntry.lines.filter(l => l.currency === 'KES');
    const kesDebit = kesLines.filter(l => l.side === 'DEBIT').reduce((acc, l) => acc + l.amountMinor, 0n);
    const kesCredit = kesLines.filter(l => l.side === 'CREDIT').reduce((acc, l) => acc + l.amountMinor, 0n);
    expect(kesDebit).toBe(kesCredit); // KES leg balances!

    // Verify 1040-FX-CLEARING is used
    const clearingLines = fxEntry.lines.filter(l => l.accountCode === '1040-FX-CLEARING');
    expect(clearingLines.length).toBe(2);
  });
});
