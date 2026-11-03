// Colour classes for the map. Pure functions.

/** Classes: < 20, 20-29, 30-39, 40-49, 50+ years of record. */
export const RECORD_LENGTH_BREAKS: readonly number[] = [20, 30, 40, 50];

/** Class index (0-based) of `value` for ascending `breaks`; -1 for a missing value. */
export function binIndex(value: number | null | undefined, breaks: readonly number[]): number {
  if (value === null || value === undefined || Number.isNaN(value)) return -1;
  let index = 0;
  while (index < breaks.length && value >= (breaks[index] as number)) index += 1;
  return index;
}

/** Break values splitting `values` into `classes` groups of roughly equal size, rounded to whole numbers. */
export function quantileBreaks(values: readonly (number | null | undefined)[], classes = 5): number[] {
  const sorted = values
    .filter((v): v is number => v !== null && v !== undefined)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const breaks: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    const position = (i * sorted.length) / classes;
    const lower = Math.floor(position);
    const upper = Math.min(sorted.length - 1, lower + 1);
    const fraction = position - lower;
    const low = sorted[lower] as number;
    const high = sorted[upper] as number;
    breaks.push(Math.round(low + (high - low) * fraction));
  }
  // Rounding can repeat a break on tightly clustered data; keep each one strictly increasing.
  return breaks.filter((b, i) => i === 0 || b > (breaks[i - 1] as number));
}

/** Human labels for the classes defined by `breaks`: ["< 20", "20–29", ..., "50+"]. */
export function binLabels(breaks: readonly number[], unit = ''): string[] {
  if (breaks.length === 0) return [];
  const suffix = unit ? ` ${unit}` : '';
  const first = breaks[0] as number;
  const last = breaks[breaks.length - 1] as number;
  const labels = [`< ${first}${suffix}`];
  for (let i = 0; i < breaks.length - 1; i += 1) {
    labels.push(`${breaks[i]}–${(breaks[i + 1] as number) - 1}${suffix}`);
  }
  labels.push(`${last}+${suffix}`);
  return labels;
}
