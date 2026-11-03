// Scale and tick helpers for the SVG charts. Pure functions.

export type Scale = (value: number) => number;

export function linearScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): Scale {
  const span = domainMax - domainMin || 1;
  return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

export function logScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): Scale {
  const lo = Math.log10(domainMin);
  const span = Math.log10(domainMax) - lo || 1;
  return (value) => rangeMin + ((Math.log10(value) - lo) / span) * (rangeMax - rangeMin);
}

const STEPS_125 = [1, 2, 5];

/** The 1-2-5 values within [min, max] (inclusive), e.g. 1, 2, 5, 10, 20, 50, 100. */
export function ticks125(min: number, max: number): number[] {
  const out: number[] = [];
  for (let exp = Math.floor(Math.log10(min)) - 1; exp <= Math.ceil(Math.log10(max)); exp += 1) {
    for (const step of STEPS_125) {
      const value = step * 10 ** exp;
      if (value >= min * (1 - 1e-9) && value <= max * (1 + 1e-9)) out.push(Number(value.toPrecision(3)));
    }
  }
  return out;
}

/** Largest 1-2-5 value <= v. */
export function nice125Down(v: number): number {
  const exp = Math.floor(Math.log10(v));
  const mantissa = v / 10 ** exp;
  const step = [...STEPS_125].reverse().find((s) => s <= mantissa + 1e-9) ?? 1;
  return step * 10 ** exp;
}

/** Smallest 1-2-5 value >= v. */
export function nice125Up(v: number): number {
  const exp = Math.floor(Math.log10(v));
  const mantissa = v / 10 ** exp;
  const step = STEPS_125.find((s) => s >= mantissa - 1e-9);
  return step === undefined ? 10 ** (exp + 1) : step * 10 ** exp;
}

/** Evenly spaced "nice" ticks covering [0, max]; `top` is the last tick. */
export function linearTicks(max: number, target = 5): { ticks: number[]; top: number } {
  if (!(max > 0)) return { ticks: [0, 1], top: 1 };
  const rough = max / target;
  const base = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * base).find((s) => s >= rough) ?? 10 * base;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toPrecision(10)));
  return { ticks, top };
}

/**
 * Spreads label positions so neighbours are at least `gap` apart, keeping their order.
 * Returns new y values in the same order as `ys`.
 */
export function spreadLabels(ys: readonly number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k += 1) {
    const previous = order[k - 1] as { y: number };
    const current = order[k] as { y: number };
    if (current.y - previous.y < gap) current.y = previous.y + gap;
  }
  const lastItem = order[order.length - 1];
  if (lastItem && lastItem.y - max > 0) {
    for (let k = order.length - 1; k >= 0; k -= 1) {
      const item = order[k] as { y: number };
      const limit = k === order.length - 1 ? max : (order[k + 1] as { y: number }).y - gap;
      item.y = Math.min(item.y, limit);
    }
  }
  for (const item of order) item.y = Math.max(min, item.y);
  const result = new Array<number>(ys.length);
  for (const { y, i } of order) result[i] = y;
  return result;
}
