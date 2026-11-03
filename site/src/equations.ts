// ECCC's fitted equations (Table 3 of every station file): R = A × T^B, with R in mm/h and T in hours.
// Depth in mm is R × T, which is also a power law: A × T^(B + 1). Pure functions: no DOM.
import type { StationDetail } from './types';

export type Quantity = 'intensity' | 'depth';

export interface Equation {
  years: number;
  /** Position of this return period in the station's lists. */
  index: number;
  coefficient: number;
  exponent: number;
}

/** The equations the station has, one per return period for which ECCC published both A and B. */
export function equations(station: Pick<StationDetail, 'returnPeriods' | 'fit'>): Equation[] {
  return station.returnPeriods.flatMap((years, index) => {
    const coefficient = station.fit.coefficient[index];
    const exponent = station.fit.exponent[index];
    return coefficient == null || exponent == null ? [] : [{ years, index, coefficient, exponent }];
  });
}

/** "R = 17.4 × T^−0.551", with a true minus sign. */
export function equationText(equation: Pick<Equation, 'coefficient' | 'exponent'>): string {
  const a = equation.coefficient.toFixed(1);
  const b = Math.abs(equation.exponent).toFixed(3);
  return `R = ${a} × T^${equation.exponent < 0 ? '−' : ''}${b}`;
}

/** The equation's value at a duration in hours: intensity in mm/h, or depth in mm. */
export function fittedValue(equation: Pick<Equation, 'coefficient' | 'exponent'>, hours: number, quantity: Quantity): number {
  const rate = equation.coefficient * hours ** equation.exponent;
  return quantity === 'depth' ? rate * hours : rate;
}

/**
 * The durations, in hours, over which the equations were fitted: from the shortest duration ECCC analysed at this
 * station to the longest. Null when no duration was analysed. Drawing the lines no further than this keeps them from
 * claiming more than ECCC fitted.
 */
export function fitSpanHours(station: Pick<StationDetail, 'durations' | 'sampleYears'>): { from: number; to: number } | null {
  const analysed = station.durations.filter((_, d) => (station.sampleYears[d] ?? 0) > 0);
  if (analysed.length === 0) return null;
  return { from: Math.min(...analysed) / 60, to: Math.max(...analysed) / 60 };
}
