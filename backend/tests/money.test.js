import { describe, it, expect } from 'vitest';
import { parseMinorUnits, formatMinorUnits } from '../src/shared/money.js';

describe('money helpers', () => {
  it('converts decimal currency into integer minor units', () => {
    expect(parseMinorUnits('125.50')).toBe(12550n);
    expect(formatMinorUnits(12550n)).toBe('125.50');
  });
  it('rejects more than two decimal places', () => {
    expect(() => parseMinorUnits('1.234')).toThrow();
  });
  it('rejects zero and negative amounts', () => {
    expect(() => parseMinorUnits('0')).toThrow();
    expect(() => parseMinorUnits('-2')).toThrow();
  });
});
