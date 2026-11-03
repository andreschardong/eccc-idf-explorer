import { describe, expect, it } from 'vitest';
import {
  linearScale, linearTicks, logScale, nice125Down, nice125Up, spreadLabels, ticks125,
} from './scales';

describe('scales', () => {
  it('maps a linear domain onto a range, including inverted ranges', () => {
    const y = linearScale(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
  });

  it('maps a log domain evenly per decade', () => {
    const x = logScale(1, 1000, 0, 300);
    expect(x(1)).toBeCloseTo(0);
    expect(x(10)).toBeCloseTo(100);
    expect(x(1000)).toBeCloseTo(300);
  });
});

describe('1-2-5 helpers', () => {
  it('lists the 1-2-5 values within a range', () => {
    expect(ticks125(1, 100)).toEqual([1, 2, 5, 10, 20, 50, 100]);
    expect(ticks125(3, 60)).toEqual([5, 10, 20, 50]);
  });

  it('rounds down and up to 1-2-5 values', () => {
    expect(nice125Down(7)).toBe(5);
    expect(nice125Down(0.9)).toBe(0.5);
    expect(nice125Up(7)).toBe(10);
    expect(nice125Up(21)).toBe(50);
    expect(nice125Up(100)).toBe(100);
  });
});

describe('linearTicks', () => {
  it('covers the maximum with evenly spaced round ticks starting at zero', () => {
    const { ticks, top } = linearTicks(87);
    expect(ticks[0]).toBe(0);
    expect(top).toBeGreaterThanOrEqual(87);
    const steps = ticks.slice(1).map((t, i) => t - (ticks[i] as number));
    for (const step of steps) expect(step).toBeCloseTo(steps[0] as number);
  });

  it('falls back to 0..1 for non-positive input', () => {
    expect(linearTicks(0)).toEqual({ ticks: [0, 1], top: 1 });
  });
});

describe('spreadLabels', () => {
  it('keeps well-separated labels where they are', () => {
    expect(spreadLabels([10, 50, 90], 12, 0, 100)).toEqual([10, 50, 90]);
  });

  it('pushes bunched labels apart while keeping their order', () => {
    const out = spreadLabels([50, 51, 52], 12, 0, 200);
    expect(out[1] as number - (out[0] as number)).toBeGreaterThanOrEqual(12);
    expect(out[2] as number - (out[1] as number)).toBeGreaterThanOrEqual(12);
  });

  it('keeps labels inside the bounds', () => {
    const out = spreadLabels([95, 96, 97], 12, 0, 100);
    for (const y of out) {
      expect(y).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns results in the original order', () => {
    const out = spreadLabels([80, 20, 50], 12, 0, 100);
    expect(out).toEqual([80, 20, 50]);
  });
});
