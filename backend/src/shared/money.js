import { AppError } from './errors.js';

export const CURRENCY_CONFIG = {
  KES: { decimals: 2, symbol: 'KSh', code: 'KES', locale: 'en-KE' },
  ZAR: { decimals: 2, symbol: 'R', code: 'ZAR', locale: 'en-ZA' },
  USD: { decimals: 2, symbol: '$', code: 'USD', locale: 'en-US' },
  EUR: { decimals: 2, symbol: '€', code: 'EUR', locale: 'en-IE' },
  GBP: { decimals: 2, symbol: '£', code: 'GBP', locale: 'en-GB' },
  UGX: { decimals: 0, symbol: 'USh', code: 'UGX', locale: 'en-UG' },
  TZS: { decimals: 0, symbol: 'TSh', code: 'TZS', locale: 'en-TZ' }
};

export function getCurrencyDecimals(currency = 'KES') {
  const c = currency.toUpperCase();
  return CURRENCY_CONFIG[c]?.decimals ?? 2;
}

/**
 * Parses user input (string or number) into integer minor units without floating-point distortion.
 */
export function parseMinorUnits(value, currency = 'KES') {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new AppError('Amount must be a decimal string or number.');
  }
  const raw = String(value).trim();
  const decimals = getCurrencyDecimals(currency);

  if (decimals === 0) {
    if (!/^\d+$/.test(raw)) {
      throw new AppError(`Enter a positive whole number for ${currency}.`);
    }
    const minor = BigInt(raw);
    if (minor <= 0n) throw new AppError('Amount must be greater than zero.');
    return minor;
  }

  const regex = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  if (!regex.test(raw)) {
    throw new AppError(`Enter a positive amount with at most ${decimals} decimal places.`);
  }

  const [whole, fraction = ''] = raw.split('.');
  const multiplier = 10n ** BigInt(decimals);
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const minor = BigInt(whole) * multiplier + BigInt(paddedFraction || '0');

  if (minor <= 0n) throw new AppError('Amount must be greater than zero.');
  return minor;
}

/**
 * Parses a fractional quantity (e.g. 2.5, 0.75) into scaled units (scaled by 10,000 for 4 decimal places).
 */
export function parseQuantityScaled(value, scale = 4) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new AppError('Quantity must be a valid number or string.');
  }
  const raw = String(value).trim();
  const regex = new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`);
  if (!regex.test(raw)) {
    throw new AppError(`Quantity must be positive with at most ${scale} decimal places.`);
  }

  const [whole, fraction = ''] = raw.split('.');
  const multiplier = 10n ** BigInt(scale);
  const paddedFraction = fraction.padEnd(scale, '0').slice(0, scale);
  const scaled = BigInt(whole) * multiplier + BigInt(paddedFraction || '0');

  if (scaled <= 0n) throw new AppError('Quantity must be greater than zero.');
  return { scaled, scale };
}

/**
 * Multiplies a unit price in minor units by a scaled quantity, returning integer minor units rounded half-up.
 */
export function multiplyPriceByQuantity(unitPriceMinor, scaledQuantity, scale = 4) {
  const price = BigInt(unitPriceMinor);
  const qty = BigInt(scaledQuantity);
  const divisor = 10n ** BigInt(scale);
  const half = divisor / 2n;

  // Banker's/Half-up rounding on integer math
  return (price * qty + half) / divisor;
}

/**
 * Calculates tax in minor units given subtotal in minor units and tax rate in basis points (100 bps = 1.00%).
 * e.g., 1600 bps = 16.00% VAT, 1500 bps = 15.00% VAT.
 */
export function calculateTaxMinor(subtotalMinor, basisPoints) {
  const subtotal = BigInt(subtotalMinor);
  const bps = BigInt(basisPoints);
  const divisor = 10000n;
  const half = divisor / 2n;
  return (subtotal * bps + half) / divisor;
}

/**
 * Splits an amount into N equal parts, distributing remainder minor units deterministically.
 */
export function splitMinor(totalMinor, partsCount) {
  const total = BigInt(totalMinor);
  const count = BigInt(partsCount);
  if (count <= 0n) throw new AppError('Parts count must be positive.');

  const base = total / count;
  const remainder = Number(total % count);

  const result = [];
  for (let i = 0; i < Number(count); i++) {
    result.push(base + (i < remainder ? 1n : 0n));
  }
  return result;
}

/**
 * Formats integer minor units to a standard decimal string (e.g. "12500" -> "125.00").
 */
export function formatMinorUnits(value, currency = 'KES') {
  const minor = BigInt(value);
  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) {
    return minor.toString();
  }
  const divisor = 10n ** BigInt(decimals);
  const isNegative = minor < 0n;
  const absMinor = isNegative ? -minor : minor;
  const whole = absMinor / divisor;
  const rem = absMinor % divisor;
  const fraction = rem.toString().padStart(decimals, '0');
  return `${isNegative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Precision-safe currency display formatting with thousands separators without Number precision loss.
 */
export function formatCurrencyDisplay(valueMinor, currency = 'KES') {
  const conf = CURRENCY_CONFIG[currency?.toUpperCase()] || { symbol: currency, decimals: 2 };
  const rawDecimal = formatMinorUnits(valueMinor, currency);
  const [whole, fraction] = rawDecimal.split('.');

  // Insert commas into whole portion without converting to JS Number
  const isNeg = whole.startsWith('-');
  const absWhole = isNeg ? whole.slice(1) : whole;
  const withCommas = absWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const displayWhole = isNeg ? `-${withCommas}` : withCommas;

  if (conf.decimals === 0 || !fraction) {
    return `${conf.symbol} ${displayWhole}`;
  }
  return `${conf.symbol} ${displayWhole}.${fraction}`;
}

export const money = formatCurrencyDisplay;

/**
 * Ratio multiplication using BigInt: (amountMinor * numerator) / denominator with half-up rounding.
 */
export function mulRatioMinor(amountMinor, numerator, denominator) {
  const num = BigInt(numerator);
  const den = BigInt(denominator);
  if (den === 0n) throw new AppError('Denominator cannot be zero in financial calculation.');
  const half = den / 2n;
  return (BigInt(amountMinor) * num + half) / den;
}

/**
 * Serializes BigInt fields to strings for JSON responses.
 */
export function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}
