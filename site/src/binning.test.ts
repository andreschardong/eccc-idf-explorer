import { describe, expect, it } from 'vitest';
import {
  RECORD_LENGTH_BREAKS, binIndex, binLabels, quantileBreaks,
} from './binning';

describe('binIndex', () => {
  it('puts a value into the class whose lower bound it meets', () => {
    expect(binIndex(10, RECORD_LENGTH_BREAKS)).toBe(0);
    expect(binIndex(19, RECORD_LENGTH_BREAKS)).toBe(0);
    expect(binIndex(20, RECORD_LENGTH_BREAKS)).toBe(1);
    expect(binIndex(49, RECORD_LENGTH_BREAKS)).toBe(3);
    expect(binIndex(50, RECORD_LENGTH_BREAKS)).toBe(4);
    expect(binIndex(120, RECORD_LENGTH_BREAKS)).toBe(4);
  });

  it('returns -1 for a missing value', () => {
    expect(binIndex(null, RECORD_LENGTH_BREAKS)).toBe(-1);
    expect(binIndex(undefined, RECORD_LENGTH_BREAKS)).toBe(-1);
  });
});

describe('quantileBreaks', () => {
  it('splits evenly sized data into near-equal classes', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const breaks = quantileBreaks(values, 5);
    expect(breaks).toHaveLength(4);
    const counts = new Array<number>(5).fill(0);
    for (const v of values) counts[binIndex(v, breaks)] = (counts[binIndex(v, breaks)] ?? 0) + 1;
    for (const count of counts) expect(Math.abs(count - 20)).toBeLessThanOrEqual(2);
  });

  it('ignores missing values and returns strictly increasing breaks', () => {
    const breaks = quantileBreaks([null, 5, 5, 5, 5, 5, 6, undefined], 5);
    for (let i = 1; i < breaks.length; i += 1) expect(breaks[i]).toBeGreaterThan(breaks[i - 1] as number);
    expect(quantileBreaks([], 5)).toEqual([]);
  });
});

describe('binLabels', () => {
  it('names every class', () => {
    expect(binLabels(RECORD_LENGTH_BREAKS, 'yr')).toEqual([
      '< 20 yr', '20–29 yr', '30–39 yr', '40–49 yr', '50+ yr',
    ]);
  });
});
