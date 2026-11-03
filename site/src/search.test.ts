import { describe, expect, it } from 'vitest';
import { indexStations, rankStations } from './search';
import type { StationSummary } from './types';

function station(id: string, name: string, province: string, years: number): StationSummary {
  return {
    id, name, province, lat: 0, lon: 0, firstYear: 2000, lastYear: 2000 + years, years, composite: false,
  };
}

const stations = indexStations([
  station('8300301', 'CHARLOTTETOWN A', 'PE', 31),
  station('8300596', 'SUMMERSIDE', 'PE', 40),
  station('7016294', 'QUÉBEC/JEAN LESAGE INTL', 'QC', 60),
  station('6158731', 'TORONTO CITY', 'ON', 150),
  station('6158665', 'TORONTO INTL A', 'ON', 70),
  station('1108447', 'VANCOUVER INTL A', 'BC', 65),
]);

describe('rankStations', () => {
  it('returns nothing for a blank query', () => {
    expect(rankStations(stations, '')).toEqual([]);
    expect(rankStations(stations, '   ')).toEqual([]);
  });

  it('matches name prefixes and prefers longer records among equals', () => {
    const ids = rankStations(stations, 'toronto').map((s) => s.id);
    expect(ids).toEqual(['6158731', '6158665']);
  });

  it('ignores case and accents', () => {
    expect(rankStations(stations, 'quebec')[0]?.id).toBe('7016294');
    expect(rankStations(stations, 'QUÉBEC')[0]?.id).toBe('7016294');
  });

  it('matches the start of any word in the name', () => {
    expect(rankStations(stations, 'lesage')[0]?.id).toBe('7016294');
  });

  it('matches climate IDs', () => {
    expect(rankStations(stations, '8300596').map((s) => s.id)).toEqual(['8300596']);
  });

  it('matches a province by code or name', () => {
    expect(rankStations(stations, 'pe').map((s) => s.id).sort()).toContain('8300301');
    expect(rankStations(stations, 'british columbia').map((s) => s.id)).toEqual(['1108447']);
  });

  it('returns at most eight results', () => {
    const many = indexStations(Array.from({ length: 30 }, (_, i) => station(`x${i}`, `ALPHA ${i}`, 'AB', i)));
    expect(rankStations(many, 'alpha')).toHaveLength(8);
  });
});
