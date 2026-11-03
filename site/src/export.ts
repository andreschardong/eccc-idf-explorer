// Client-side export of one station as CSV. Pure string building; `downloadText` is the only DOM use.
import { saveBlob } from './download';
import type { StationDetail } from './types';

const HEADER = [
  'climate_id', 'station', 'province', 'latitude', 'longitude', 'duration_min',
  'return_period_yr', 'depth_mm', 'intensity_mm_per_h', 'intensity_ci95_mm_per_h',
];

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One row per duration x return period; empty cells where ECCC has no value. */
export function stationToCsv(
  station: Pick<StationDetail, 'id' | 'name' | 'province' | 'lat' | 'lon' | 'durations' | 'returnPeriods' | 'depths' | 'rates' | 'confidence'>,
): string {
  const lines = [HEADER.join(',')];
  station.durations.forEach((minutes, d) => {
    station.returnPeriods.forEach((years, p) => {
      lines.push([
        station.id, station.name, station.province, station.lat, station.lon, minutes, years,
        station.depths[d]?.[p], station.rates[d]?.[p], station.confidence[d]?.[p],
      ].map(csvCell).join(','));
    });
  });
  return `${lines.join('\r\n')}\r\n`;
}

export function csvFileName(station: Pick<StationDetail, 'id'>, release: string): string {
  return `eccc-idf-v${release}-${station.id}.csv`;
}

/** Offers `text` as a file download. A BOM keeps accented station names intact in Excel. */
export function downloadText(fileName: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  saveBlob(new Blob(['\uFEFF', text], { type: mime }), fileName);
}
