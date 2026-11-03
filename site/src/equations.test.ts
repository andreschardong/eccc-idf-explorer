import { describe, expect, it } from 'vitest';
import {
  equationText, equations, fitSpanHours, fittedValue,
} from './equations';

const station = {
  returnPeriods: [2, 5, 100],
  fit: {
    coefficient: [17.4, 23.5, null],
    exponent: [-0.551, -0.563, null],
    standardError: [],
    meanPercentError: [],
  },
};

describe('equations', () => {
  it('lists one equation per return period that has both A and B', () => {
    expect(equations(station)).toEqual([
      { years: 2, index: 0, coefficient: 17.4, exponent: -0.551 },
      { years: 5, index: 1, coefficient: 23.5, exponent: -0.563 },
    ]);
  });

  it('keeps the position of each period, so colours and rows stay matched', () => {
    const skipFirst = { ...station, fit: { ...station.fit, coefficient: [null, 23.5, 40.1], exponent: [null, -0.563, -0.578] } };
    expect(equations(skipFirst).map((e) => e.index)).toEqual([1, 2]);
  });
});

describe('equationText', () => {
  it('writes ECCC\'s form with a true minus sign and three decimals on the exponent', () => {
    expect(equationText({ coefficient: 17.4, exponent: -0.551 })).toBe('R = 17.4 × T^−0.551');
    expect(equationText({ coefficient: 40.123, exponent: -0.5 })).toBe('R = 40.1 × T^−0.500');
  });

  it('leaves out the sign for a positive exponent', () => {
    expect(equationText({ coefficient: 2, exponent: 0.25 })).toBe('R = 2.0 × T^0.250');
  });
});

describe('fittedValue', () => {
  const e = { coefficient: 17.4, exponent: -0.551 };

  it('is the coefficient at one hour', () => {
    expect(fittedValue(e, 1, 'intensity')).toBe(17.4);
    expect(fittedValue(e, 1, 'depth')).toBe(17.4);
  });

  it('gives depth as intensity times duration', () => {
    expect(fittedValue(e, 6, 'depth')).toBeCloseTo(fittedValue(e, 6, 'intensity') * 6, 12);
    expect(fittedValue(e, 0.25, 'depth')).toBeCloseTo(fittedValue(e, 0.25, 'intensity') * 0.25, 12);
  });

  it('falls with duration as intensity and rises with duration as depth (for B between -1 and 0)', () => {
    expect(fittedValue(e, 24, 'intensity')).toBeLessThan(fittedValue(e, 1, 'intensity'));
    expect(fittedValue(e, 24, 'depth')).toBeGreaterThan(fittedValue(e, 1, 'depth'));
  });

  it('is a straight line on log-log axes: equal ratios over equal ratios of duration', () => {
    const slope = (a: number, b: number): number => Math.log(fittedValue(e, b, 'intensity') / fittedValue(e, a, 'intensity')) / Math.log(b / a);
    expect(slope(0.25, 1)).toBeCloseTo(-0.551, 10);
    expect(slope(2, 24)).toBeCloseTo(-0.551, 10);
    const depthSlope = Math.log(fittedValue(e, 24, 'depth') / fittedValue(e, 1, 'depth')) / Math.log(24);
    expect(depthSlope).toBeCloseTo(0.449, 10);
  });
});

describe('fitSpanHours', () => {
  const durations = [5, 10, 15, 30, 60, 120, 360, 720, 1440];

  it('runs from the shortest analysed duration to the longest', () => {
    expect(fitSpanHours({ durations, sampleYears: [31, 31, 31, 31, 31, 31, 32, 32, 32] })).toEqual({ from: 5 / 60, to: 24 });
  });

  it('starts later when the short durations were not analysed', () => {
    expect(fitSpanHours({ durations, sampleYears: [0, 0, 0, 0, 14, 14, 14, 14, 14] })).toEqual({ from: 1, to: 24 });
  });

  it('is null when nothing was analysed', () => {
    expect(fitSpanHours({ durations, sampleYears: durations.map(() => 0) })).toBeNull();
  });
});
