import { describe, expect, it } from 'vitest';
import {
  durationAxisLabel, durationLabel, foldText, formatCoordinates, formatValue, prettyName, provinceName,
} from './format';

describe('durationAxisLabel', () => {
  it('keeps minutes short and switches to hours at 60', () => {
    expect(durationAxisLabel(5)).toBe('5m');
    expect(durationAxisLabel(30)).toBe('30m');
    expect(durationAxisLabel(60)).toBe('1h');
    expect(durationAxisLabel(1440)).toBe('24h');
  });
});

describe('durationLabel', () => {
  it('spells out the unit', () => {
    expect(durationLabel(15)).toBe('15 min');
    expect(durationLabel(720)).toBe('12 h');
  });
});

describe('formatValue', () => {
  it('shows an en dash for missing values', () => {
    expect(formatValue(null)).toBe('–');
    expect(formatValue(undefined)).toBe('–');
    expect(formatValue(Number.NaN)).toBe('–');
  });

  it('uses one decimal by default and groups thousands', () => {
    expect(formatValue(5.123)).toBe('5.1');
    expect(formatValue(0.551, 3)).toBe('0.551');
    expect(formatValue(1234.5)).toBe('1,234.5');
  });
});

describe('formatCoordinates', () => {
  it('labels hemispheres', () => {
    expect(formatCoordinates(46.2833, -63.1167)).toBe('46.28° N, 63.12° W');
    expect(formatCoordinates(-12.5, 30.25)).toBe('12.50° S, 30.25° E');
  });
});

describe('prettyName', () => {
  it('title-cases words and keeps station abbreviations', () => {
    expect(prettyName('CHARLOTTETOWN A')).toBe('Charlottetown A');
    expect(prettyName('EAST POINT (AUT)')).toBe('East Point (AUT)');
    expect(prettyName("L'ASSOMPTION")).toBe("L'Assomption");
    expect(prettyName('ST. PETERS')).toBe('St. Peters');
    expect(prettyName('GREAT FALLS CS')).toBe('Great Falls CS');
    expect(prettyName('ST THOMAS WPCP')).toBe('St Thomas WPCP');
    expect(prettyName('CARNATION CREEK CDF')).toBe('Carnation Creek CDF');
  });
});

describe('foldText', () => {
  it('removes accents and case for matching', () => {
    expect(foldText('QUÉBEC')).toBe('quebec');
    expect(foldText('Saint-Hyacinthe')).toBe('saint-hyacinthe');
  });
});

describe('provinceName', () => {
  it('expands known codes and passes unknown ones through', () => {
    expect(provinceName('PE')).toBe('Prince Edward Island');
    expect(provinceName('ZZ')).toBe('ZZ');
  });
});
