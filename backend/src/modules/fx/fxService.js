import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { CURRENCY_CONFIG, getCurrencyDecimals } from '../../shared/money.js';

export class FxService {
  constructor() {
    this.currencyDecimals = {
      KES: 2,
      ZAR: 2,
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
      ZAR: 18.20,
      EUR: 0.92,
      GBP: 0.79,
      UGX: 3700.0,
      TZS: 2550.0,
    };

    this.activeQuotes = new Map();
  }

  getSupportedCurrencies() {
    return Object.keys(this.currencyDecimals);
  }

  getExchangeRate(fromCurrency, toCurrency) {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (!this.ratesToUsd[from] || !this.ratesToUsd[to]) {
      throw new AppError(`Unsupported currency pair: ${from}/${to}`, 400);
    }

    const rate = this.ratesToUsd[to] / this.ratesToUsd[from];
    return Number(rate.toFixed(6));
  }

  convert(amountMinor, fromCurrency, toCurrency, spreadPercentage = 0) {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (amountMinor < 0) {
      throw new AppError('Amount cannot be negative', 400);
    }

    if (from === to) {
      return {
        sourceAmountMinor: Number(amountMinor),
        targetAmountMinor: Number(amountMinor),
        fromCurrency: from,
        toCurrency: to,
        exchangeRate: 1.0,
        baseRate: 1.0,
        effectiveRate: 1.0,
        spreadPercentage: 0,
      };
    }

    const fromDecimals = this.currencyDecimals[from];
    const toDecimals = this.currencyDecimals[to];

    if (fromDecimals === undefined || toDecimals === undefined) {
      throw new AppError(`Unsupported currency: ${fromDecimals === undefined ? from : to}`, 400);
    }

    // Convert source minor units to standard major decimal amount
    const sourceMajor = Number(amountMinor) / Math.pow(10, fromDecimals);

    // Apply mid-market exchange rate
    const midRate = this.getExchangeRate(from, to);

    // Apply spread (deduction for receiving currency)
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
      baseRate: midRate,
      effectiveRate: Number(effectiveRate.toFixed(6)),
      spreadPercentage,
    };
  }

  /**
   * Dual-mode createQuote:
   * 1. createQuote(amountMinor, fromCurrency, toCurrency, spreadPercentage) -> in-memory
   * 2. createQuote({ workspaceId, fromCurrency, toCurrency, sourceAmountMinor, spreadPercentage, validityMinutes }) -> PostgreSQL
   */
  createQuote(arg1, arg2, arg3, arg4) {
    if (typeof arg1 === 'object') {
      const { workspaceId, fromCurrency, toCurrency, sourceAmountMinor, spreadPercentage = 0.005, validityMinutes = 15 } = arg1;
      return this.createPersistentQuote({ workspaceId, fromCurrency, toCurrency, sourceAmountMinor, spreadPercentage, validityMinutes });
    }

    const amountMinor = arg1;
    const fromCurrency = arg2;
    const toCurrency = arg3;
    const spreadPercentage = arg4 !== undefined ? arg4 : 0.005;

    const conversion = this.convert(amountMinor, fromCurrency, toCurrency, spreadPercentage);
    const quoteId = `fxq_${crypto.randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

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

  async createPersistentQuote({ workspaceId, fromCurrency, toCurrency, sourceAmountMinor, spreadPercentage = 0.005, validityMinutes = 15 }) {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    const conversion = this.convert(sourceAmountMinor, from, to, spreadPercentage);

    const quoteRef = `FXQ-${from}-${to}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + validityMinutes * 60000);

    const quote = await prisma.fXQuote.create({
      data: {
        workspaceId,
        quoteRef,
        fromCurrency: from,
        toCurrency: to,
        rate: conversion.baseRate,
        spread: spreadPercentage,
        sourceAmountMinor: BigInt(sourceAmountMinor),
        targetAmountMinor: BigInt(conversion.targetAmountMinor),
        expiresAt,
        status: 'ACTIVE',
        provider: 'HESABU_FX'
      }
    });

    return quote;
  }

  /**
   * Lock an active FX quote
   */
  async lockQuote(quoteRef) {
    const quote = await prisma.fXQuote.findUnique({ where: { quoteRef } });
    if (!quote) throw new AppError('FX quote not found.', 404);

    if (quote.status !== 'ACTIVE') {
      throw new AppError(`Cannot lock quote in ${quote.status} status.`, 400);
    }
    if (new Date() > quote.expiresAt) {
      await prisma.fXQuote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' } });
      throw new AppError('FX quote has expired.', 400);
    }

    return prisma.fXQuote.update({
      where: { id: quote.id },
      data: { status: 'LOCKED' }
    });
  }

  /**
   * Execute conversion and post GAAP multi-currency journal entries
   */
  async executeConversion({ quoteRef, settlementRef, actorId }) {
    const quote = await prisma.fXQuote.findUnique({
      where: { quoteRef },
      include: { workspace: true }
    });
    if (!quote) throw new AppError('FX quote not found.', 404);

    if (quote.status === 'EXECUTED') {
      throw new AppError('Quote has already been executed.', 400);
    }
    if (new Date() > quote.expiresAt) {
      throw new AppError('FX quote has expired and cannot be executed.', 400);
    }

    const conversion = await prisma.$transaction(async (tx) => {
      await tx.fXQuote.update({
        where: { id: quote.id },
        data: { status: 'EXECUTED' }
      });

      const conv = await tx.fXConversion.create({
        data: {
          workspaceId: quote.workspaceId,
          quoteId: quote.id,
          fromCurrency: quote.fromCurrency,
          toCurrency: quote.toCurrency,
          sourceAmountMinor: quote.sourceAmountMinor,
          targetAmountMinor: quote.targetAmountMinor,
          rate: quote.rate,
          settlementRef: settlementRef || `FX-SETTLE-${quote.id.slice(0, 8)}`,
        }
      });

      // Post GAAP multi-currency balanced journal entry:
      // Using 1040-FX-CLEARING to ensure that debits equal credits for each distinct currency leg
      const journal = await tx.journalEntry.create({
        data: {
          workspaceId: quote.workspaceId,
          reference: `JOURNAL-FX-${conv.id.slice(0, 8)}-${Date.now()}`,
          description: `FX Cross-border conversion: ${quote.fromCurrency} ${quote.sourceAmountMinor.toString()} to ${quote.toCurrency} ${quote.targetAmountMinor.toString()} @ rate ${quote.rate.toString()}`,
          lines: {
            create: [
              // Source currency leg: Debit 1040-FX-CLEARING, Credit 1000-CASH-CLEARING
              { accountCode: '1040-FX-CLEARING', side: 'DEBIT', amountMinor: quote.sourceAmountMinor, currency: quote.fromCurrency },
              { accountCode: '1000-CASH-CLEARING', side: 'CREDIT', amountMinor: quote.sourceAmountMinor, currency: quote.fromCurrency },
              // Target currency leg: Debit 1000-CASH-CLEARING, Credit 1040-FX-CLEARING
              { accountCode: '1000-CASH-CLEARING', side: 'DEBIT', amountMinor: quote.targetAmountMinor, currency: quote.toCurrency },
              { accountCode: '1040-FX-CLEARING', side: 'CREDIT', amountMinor: quote.targetAmountMinor, currency: quote.toCurrency }
            ]
          }
        }
      });

      await tx.auditLog.create({
        data: {
          workspaceId: quote.workspaceId,
          actorId,
          action: 'FX_CONVERSION_EXECUTED',
          entityType: 'FXConversion',
          entityId: conv.id,
          details: { quoteRef, journalEntryId: journal.id, rate: quote.rate.toString() }
        }
      });

      return conv;
    });

    return conversion;
  }
}

export const fxService = new FxService();
