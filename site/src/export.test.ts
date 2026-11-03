import { describe, expect, it } from 'vitest';
import { csvFileName, stationToCsv } from './export';

const station = {
  id: '8300301',
  name: 'EAST POINT, "AUT"',
  province: 'PE',
  lat: 46.2833,
  lon: -63.1167,
  durations: [5, 60],
  returnPeriods: [2, 100],
  depths: [[5.1, 13.7], [null, 40.5]],
  rates: [[60.8, 164.6], [null, 40.5]],
  confidence: [[10.2, 43.4], [null, 9.1]],
};

describe('stationToCsv', () => {
  const lines = stationToCsv(station).trimEnd().split('\r\n');

  it('writes a header and one row per duration and return period', () => {
    expect(lines).toHaveLength(1 + 2 * 2);
    expect(lines[0]?.split(',')[0]).toBe('climate_id');
  });

  it('leaves missing values empty', () => {
    expect(lines[3]?.endsWith(',60,2,,,')).toBe(true);
  });

  it('quotes names containing commas and quotes', () => {
    expect(lines[1]?.startsWith('8300301,"EAST POINT, ""AUT""",PE,')).toBe(true);
  });
});

describe('csvFileName', () => {
  it('carries the release and climate ID', () => {
    expect(csvFileName(station, '3.40')).toBe('eccc-idf-v3.40-8300301.csv');
  });
});
