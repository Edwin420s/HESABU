import { AppError } from './errors.js';

export function parseMinorUnits(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new AppError('Amount must be a decimal string or number.');
  }
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new AppError('Enter a positive amount with at most two decimal places.');
  }
  const [whole, fraction = ''] = raw.split('.');
  const minor = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (minor <= 0n) throw new AppError('Amount must be greater than zero.');
  return minor;
}

export function formatMinorUnits(value) {
  const minor = BigInt(value);
  const whole = minor / 100n;
  const fraction = String(minor % 100n).padStart(2, '0');
  return `${whole}.${fraction}`;
}

export function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  ));
}
