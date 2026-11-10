import { Router } from 'express';
import { fxService } from './fxService.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../shared/errors.js';

export const fxRouter = Router();

/**
 * GET /api/fx/rates
 * Public/Authenticated rates listing
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
      throw new AppError('amountMinor, fromCurrency, and toCurrency are required', 400, 'INVALID_INPUT');
    }

    const result = fxService.convert(Number(amountMinor), fromCurrency, toCurrency, Number(spreadPercentage));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:workspaceId/fx/quote
 * Lock in an FX conversion quote for 15 minutes
 */
fxRouter.post('/workspaces/:workspaceId/fx/quote', authenticate, (req, res, next) => {
  try {
    const { amountMinor, fromCurrency, toCurrency, spreadPercentage = 0.005 } = req.body;

    if (amountMinor === undefined || !fromCurrency || !toCurrency) {
      throw new AppError('amountMinor, fromCurrency, and toCurrency are required', 400, 'INVALID_INPUT');
    }

    const quote = fxService.createQuote(Number(amountMinor), fromCurrency, toCurrency, Number(spreadPercentage));
    res.status(201).json(quote);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/fx/quotes/:quoteId
 * Retrieve quote details
 */
fxRouter.get('/fx/quotes/:quoteId', authenticate, (req, res, next) => {
  try {
    const quote = fxService.getQuote(req.params.quoteId);
    if (!quote) {
      throw new AppError('FX quote not found or has expired', 404, 'NOT_FOUND');
    }
    res.json(quote);
  } catch (err) {
    next(err);
  }
});
