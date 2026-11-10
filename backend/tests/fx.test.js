import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
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
});
