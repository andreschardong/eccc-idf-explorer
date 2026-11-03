// Formatting helpers. Pure functions: no DOM, so they run under Vitest in plain Node.

/** Short axis label for a duration in minutes: 5m, 30m, 1h, 24h. */
export function durationAxisLabel(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${minutes / 60}h`;
}

/** Plain label for a duration in minutes: "5 min", "1 h". */
export function durationLabel(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

export function returnPeriodLabel(years: number): string {
  return `${years}-year`;
}

/** One decimal by default; an en dash for a missing value. */
export function formatValue(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return value.toLocaleString('en-CA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 46.2833, -63.1167 -> "46.28° N, 63.12° W" */
export function formatCoordinates(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

// ECCC prints station names in capitals. These tokens are abbreviations and stay as printed.
const KEEP_UPPER = new Set([
  // Station and equipment types
  'A', 'AUT', 'AWOS', 'CDA', 'CS', 'RCS', 'UA', 'PCC', 'CCG', 'GSN', 'STN', 'STP', 'TP', 'TS', 'WPCC', 'WPCP', 'WWTP', 'HQ',
  // Agencies and sites
  'BCHP', 'BCHPA', 'BCFS', 'CDF', 'CFB', 'CFS', 'CWB', 'DND', 'IHD', 'MOE', 'MRC', 'NRC', 'PFRA', 'RBG', 'RCAF', 'SPC', 'UBC', 'USA',
  // Roman numerals and province codes
  'II', 'III', 'IV', 'BC', 'NB', 'NS', 'NL', 'PE', 'QC', 'ON', 'MB', 'SK', 'AB', 'YT', 'NT', 'NU',
]);

/** "ST. JEAN-DE-DIEU (AUT)" -> "St. Jean-De-Dieu (AUT)" */
export function prettyName(name: string): string {
  return name
    .split(/([\s\-'(),./]+)/)
    .map((part, i) => {
      if (i % 2 === 1 || part === '') return part;
      if (KEEP_UPPER.has(part)) return part;
      return part.charAt(0) + part.slice(1).toLowerCase();
    })
    .join('');
}

/** Lower-case, accent-free text for matching. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export const PROVINCES: Readonly<Record<string, string>> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
};

export function provinceName(code: string): string {
  return PROVINCES[code] ?? code;
}
