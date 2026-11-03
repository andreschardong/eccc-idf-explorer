import { describe, expect, it } from 'vitest';
import {
  depthMm, evaluateFit, intensityMmPerHour, toHours,
} from './calculator';

const station = {
  returnPeriods: [2, 5, 10],
  fit: {
    coefficient: [17.4, 23.5, null],
    exponent: [-0.551, -0.563, null],
    standardError: [],
    meanPercentError: [],
  },
};

describe('power-law fit', () => {
  it('gives the coefficient as the intensity at one hour', () => {
    expect(intensityMmPerHour(17.4, -0.551, 1)).toBe(17.4);
  });

  it('makes depth the intensity times the duration', () => {
    const intensity = intensityMmPerHour(17.4, -0.551, 2);
    expect(depthMm(17.4, -0.551, 2)).toBeCloseTo(intensity * 2, 12);
  });
});

describe('toHours', () => {
  it('converts minutes and hours', () => {
    expect(toHours(90, 'min')).toBe(1.5);
    expect(toHours(2, 'h')).toBe(2);
  });

  it('rejects zero, negative, non-finite and unknown-unit input', () => {
    expect(toHours(0, 'h')).toBeNaN();
    expect(toHours(-5, 'min')).toBeNaN();
    expect(toHours(Number.NaN, 'min')).toBeNaN();
    expect(toHours(5, 'days')).toBeNaN();
  });
});

describe('evaluateFit', () => {
  it('uses the fit of the requested return period', () => {
    const result = evaluateFit(station, 5, 1);
    expect(result?.coefficient).toBe(23.5);
    expect(result?.intensity).toBe(23.5);
    expect(result?.outsideRange).toBe(false);
  });

  it('flags durations outside 5 minutes to 24 hours', () => {
    expect(evaluateFit(station, 2, 4 / 60)?.outsideRange).toBe(true);
    expect(evaluateFit(station, 2, 5 / 60)?.outsideRange).toBe(false);
    expect(evaluateFit(station, 2, 24)?.outsideRange).toBe(false);
    expect(evaluateFit(station, 2, 36)?.outsideRange).toBe(true);
  });

  it('returns null for an unknown period or a missing fit', () => {
    expect(evaluateFit(station, 100, 1)).toBeNull();
    expect(evaluateFit(station, 10, 1)).toBeNull();
  });
});
