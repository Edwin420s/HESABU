import { Router } from 'express';
import { fxService } from './fxService.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { jsonSafe } from '../../shared/money.js';

export const fxRouter = Router();

/**
 * GET /api/fx/rates
 * Rates listing including KES, ZAR, USD, EUR, GBP, UGX, TZS
 */
fxRouter.get('/fx/rates', (_req, res) => {
  const currencies = fxService.getSupportedCurrencies();
  const rates = {};

  for (const c of currencies) {
    rates[c] = {
      rateToUsd: fxService.ratesToUsd[c],
      decimals: fxService.currencyDecimals[c],
    };
  }

  res.json({
    base: 'USD',
    timestamp: new Date().toISOString(),
    currencies,
    rates,
  });
});

/**
 * POST /api/fx/convert
 * Convert minor unit amounts between currencies
 */
fxRouter.post('/fx/convert', (req, res, next) => {
  try {
    const { amountMinor, fromCurrency, toCurrency, spreadPercentage = 0 } = req.body;

    if (amountMinor === undefined || !fromCurrency || !toCurrency) {
      throw new AppError('amountMinor, fromCurrency, and toCurrency are required.', 400, 'INVALID_INPUT');
    }

    const result = fxService.convert(amountMinor, fromCurrency, toCurrency, Number(spreadPercentage));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:workspaceId/fx/quote
 * Create an immutable, persistent FX conversion quote in PostgreSQL
 */
fxRouter.post('/workspaces/:workspaceId/fx/quote', authenticate, requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { amountMinor, fromCurrency, toCurrency, spreadPercentage = 0.005, validityMinutes = 15 } = req.body;

    if (amountMinor === undefined || !fromCurrency || !toCurrency) {
      throw new AppError('amountMinor, fromCurrency, and toCurrency are required.', 400, 'INVALID_INPUT');
    }

    const quote = await fxService.createQuote({
      workspaceId,
      fromCurrency,
      toCurrency,
      sourceAmountMinor: amountMinor,
      spreadPercentage: Number(spreadPercentage),
      validityMinutes: Number(validityMinutes)
    });

    res.status(201).json(jsonSafe(quote));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/workspaces/:workspaceId/fx/quotes
 * List workspace FX quotes
 */
fxRouter.get('/workspaces/:workspaceId/fx/quotes', authenticate, requireWorkspaceRole, async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const quotes = await prisma.fXQuote.findMany({
      where: { workspaceId },
      include: { conversions: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ workspaceId, quotes: jsonSafe(quotes) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/fx/quotes/:quoteRef/execute
 * Execute conversion and post multi-currency balanced journal entries
 */
fxRouter.post('/fx/quotes/:quoteRef/execute', authenticate, async (req, res, next) => {
  try {
    const { quoteRef } = req.params;
    const { settlementRef } = req.body;

    const quote = await prisma.fXQuote.findUnique({ where: { quoteRef } });
    if (!quote) throw new AppError('FX quote not found.', 404);

    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId: quote.workspaceId } }
    });
    if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
      throw new AppError('Only workspace Owners, Admins, or Finance Managers can execute FX conversions.', 403);
    }

    const conversion = await fxService.executeConversion({
      quoteRef,
      settlementRef,
      actorId: req.user.id
    });

    res.json(jsonSafe(conversion));
  } catch (err) {
    next(err);
  }
});
