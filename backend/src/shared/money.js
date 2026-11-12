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

export function formatMinorUnits(value, currency = 'KES') {
  const minor = BigInt(value);
  const decimals = getCurrencyDecimals(currency);
  if (decimals === 0) {
    return minor.toString();
  }
  const divisor = 10n ** BigInt(decimals);
  const whole = minor / divisor;
  const rem = minor % divisor;
  const fraction = (rem < 0n ? -rem : rem).toString().padStart(decimals, '0');
  return `${whole}.${fraction}`;
}

export function formatCurrencyDisplay(valueMinor, currency = 'KES') {
  const conf = CURRENCY_CONFIG[currency?.toUpperCase()] || { symbol: currency, decimals: 2 };
  const formatted = formatMinorUnits(valueMinor, currency);
  return `${conf.symbol} ${Number(formatted).toLocaleString(conf.locale || 'en-US', {
    minimumFractionDigits: conf.decimals,
    maximumFractionDigits: conf.decimals
  })}`;
}

export function mulRatioMinor(amountMinor, numerator, denominator) {
  const num = BigInt(numerator);
  const den = BigInt(denominator);
  if (den === 0n) throw new AppError('Denominator cannot be zero in financial calculation.');
  return (BigInt(amountMinor) * num) / den;
}

export function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}
