// Table 3 of every ECCC station file gives a power-law fit per return period:
//   R = A * T^B     R in mm/h, T in hours
// This is the only interpolation ECCC publishes, and it is fitted to 5 min - 24 h.
import type { StationDetail } from './types';

export const MIN_DURATION_HOURS = 5 / 60;
export const MAX_DURATION_HOURS = 24;

export interface FitResult {
  /** mm/h */
  intensity: number;
  /** mm */
  depth: number;
  coefficient: number;
  exponent: number;
  /** True when the duration lies outside the 5 min - 24 h the fit was made for. */
  outsideRange: boolean;
}

/** Rainfall intensity in mm/h for a duration in hours. */
export function intensityMmPerHour(coefficient: number, exponent: number, durationHours: number): number {
  return coefficient * durationHours ** exponent;
}

/** Rainfall depth in mm over a duration in hours. */
export function depthMm(coefficient: number, exponent: number, durationHours: number): number {
  return intensityMmPerHour(coefficient, exponent, durationHours) * durationHours;
}

/** Converts a number and a unit to hours. Returns NaN for bad input. */
export function toHours(value: number, unit: string): number {
  if (!Number.isFinite(value) || value <= 0) return Number.NaN;
  if (unit === 'min') return value / 60;
  if (unit === 'h') return value;
  return Number.NaN;
}

/**
 * Evaluates the fit for one return period of a station.
 * Returns null when the station has no fit for that period.
 */
export function evaluateFit(
  station: Pick<StationDetail, 'returnPeriods' | 'fit'>,
  returnPeriodYears: number,
  durationHours: number,
): FitResult | null {
  const index = station.returnPeriods.indexOf(returnPeriodYears);
  if (index < 0) return null;
  const a = station.fit.coefficient[index];
  const b = station.fit.exponent[index];
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return {
    intensity: intensityMmPerHour(a, b, durationHours),
    depth: depthMm(a, b, durationHours),
    coefficient: a,
    exponent: b,
    outsideRange: durationHours < MIN_DURATION_HOURS - 1e-9 || durationHours > MAX_DURATION_HOURS + 1e-9,
  };
}
