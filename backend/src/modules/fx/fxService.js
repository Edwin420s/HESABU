import crypto from 'crypto';

export class FxService {
  constructor() {
    // Currency minor units decimals (e.g. KES: 2 => cents, UGX: 0 => whole)
    this.currencyDecimals = {
      KES: 2,
      USD: 2,
      EUR: 2,
      GBP: 2,
      UGX: 0,
      TZS: 0,
    };

    // Base exchange rates relative to USD (1 USD = X Currency)
    this.ratesToUsd = {
      USD: 1.0,
      KES: 130.0,
      EUR: 0.92,
      GBP: 0.79,
      UGX: 3700.0,
      TZS: 2550.0,
    };

    this.activeQuotes = new Map();
  }

  /**
   * Return supported currencies and their scale
   */
  getSupportedCurrencies() {
    return Object.keys(this.currencyDecimals);
  }

  /**
   * Calculate exchange rate between any two supported currencies
   */
  getExchangeRate(fromCurrency, toCurrency) {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (!this.ratesToUsd[from] || !this.ratesToUsd[to]) {
      throw new Error(`Unsupported currency pair: ${from}/${to}`);
    }

    // Rate = (Rate of To in USD) / (Rate of From in USD)
    const rate = this.ratesToUsd[to] / this.ratesToUsd[from];
    return Number(rate.toFixed(6));
  }

  /**
   * Convert an amount in integer minor units between two currencies
   * @param {number|bigint} amountMinor
   * @param {string} fromCurrency
   * @param {string} toCurrency
   * @param {number} spreadPercentage - Optional markup/spread (e.g. 0.005 for 0.5%)
   */
  convert(amountMinor, fromCurrency, toCurrency, spreadPercentage = 0) {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (amountMinor < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (from === to) {
      return {
        sourceAmountMinor: Number(amountMinor),
        targetAmountMinor: Number(amountMinor),
        fromCurrency: from,
        toCurrency: to,
        exchangeRate: 1.0,
        spreadPercentage: 0,
      };
    }

    const fromDecimals = this.currencyDecimals[from];
    const toDecimals = this.currencyDecimals[to];

    if (fromDecimals === undefined || toDecimals === undefined) {
      throw new Error(`Unsupported currency: ${fromDecimals === undefined ? from : to}`);
    }

    // Convert source minor units to standard major decimal amount
    const sourceMajor = Number(amountMinor) / Math.pow(10, fromDecimals);

    // Apply mid-market exchange rate
    const midRate = this.getExchangeRate(from, to);

    // Apply spread (reduction for receiving currency)
    const effectiveRate = midRate * (1 - spreadPercentage);

    // Calculate target in major units
    const targetMajor = sourceMajor * effectiveRate;

    // Convert to target minor units, rounded to nearest integer
    const targetMinor = Math.round(targetMajor * Math.pow(10, toDecimals));

    return {
      sourceAmountMinor: Number(amountMinor),
      targetAmountMinor: targetMinor,
      fromCurrency: from,
      toCurrency: to,
      exchangeRate: midRate,
      effectiveRate: Number(effectiveRate.toFixed(6)),
      spreadPercentage,
    };
  }

  /**
   * Issue a time-locked FX quote (valid for 15 minutes)
   */
  createQuote(amountMinor, fromCurrency, toCurrency, spreadPercentage = 0.005) {
    const conversion = this.convert(amountMinor, fromCurrency, toCurrency, spreadPercentage);
    const quoteId = `fxq_${crypto.randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const quote = {
      quoteId,
      ...conversion,
      createdAt: new Date(),
      expiresAt,
      isExpired: false,
    };

    this.activeQuotes.set(quoteId, quote);
    return quote;
  }

  /**
   * Retrieve and validate an active quote
   */
  getQuote(quoteId) {
    const quote = this.activeQuotes.get(quoteId);
    if (!quote) return null;

    if (new Date() > quote.expiresAt) {
      quote.isExpired = true;
      this.activeQuotes.delete(quoteId);
      return null;
    }

    return quote;
  }

  /**
   * Update active FX rates (e.g. from central bank / FX feed)
   */
  updateRate(currency, rateToUsd) {
    const code = currency.toUpperCase();
    if (rateToUsd <= 0) {
      throw new Error('Rate must be positive');
    }
    this.ratesToUsd[code] = rateToUsd;
  }
}

export const fxService = new FxService();
