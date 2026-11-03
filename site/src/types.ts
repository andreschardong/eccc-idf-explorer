// The JSON contract written by `eccc-idf build-site-data` (see SiteDataModels.cs).
// The .NET side omits null properties and writes null for missing cells inside matrices.

/** One value per cell; null where ECCC did not analyse the duration. */
export type Cell = number | null;

/** Indexed [duration][return period] unless noted otherwise. */
export type Matrix = Cell[][];

export interface DatasetInfo {
  release: string;
  processingDate: string;
  latestYear: number;
  stationCount: number;
  method: string;
  source: string;
  licence: string;
  licenceUrl: string;
}

/** A row of stations.json: enough to draw and filter the map. */
export interface StationSummary {
  id: string;
  name: string;
  province: string;
  lat: number;
  lon: number;
  elevation?: number;
  firstYear: number;
  lastYear: number;
  years: number;
  composite: boolean;
  depth100Yr1h?: number;
  depth100Yr24h?: number;
}

export interface AnnualSummary {
  sampleSizes: (number | null)[];
  mean: Cell[];
  standardDeviation: Cell[];
  skewness: Cell[];
  kurtosis: Cell[];
}

/** R = A * T^B per return period, R in mm/h and T in hours. */
export interface PowerLawFit {
  coefficient: Cell[];
  exponent: Cell[];
  standardError: Cell[];
  meanPercentError: Cell[];
}

/** A file of stations/{id}.json. */
export interface StationDetail {
  id: string;
  name: string;
  province: string;
  composite: boolean;
  lat: number;
  lon: number;
  elevation?: number;
  firstYear: number;
  lastYear: number;
  years: number;
  /** Minutes: 5, 10, 15, 30, 60, 120, 360, 720, 1440. */
  durations: number[];
  /** Years: 2, 5, 10, 25, 50, 100, 200. */
  returnPeriods: number[];
  /** Rainfall depth in mm. */
  depths: Matrix;
  /** Rainfall rate in mm/h. */
  rates: Matrix;
  /** Half-width of the 95 % confidence interval of the rate, mm/h. */
  confidence: Matrix;
  /** Years of data behind each duration; 0 when not analysed. */
  sampleYears: number[];
  annualMaxYears: number[];
  /** Annual maximum depth in mm, indexed [year][duration]. */
  annualMaxDepths: Matrix;
  annualSummary: AnnualSummary;
  fit: PowerLawFit;
  /** ECCC's file name without extension; the station's PDF and PNG names are built from it. */
  officialFileStem?: string;
}
