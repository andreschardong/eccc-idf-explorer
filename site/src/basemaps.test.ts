import { describe, expect, it } from 'vitest';
import {
  BASEMAPS, basemapsFor, defaultBasemap, resolveBasemap, styleOf,
} from './basemaps';

const ids = (theme: 'light' | 'dark'): string[] => basemapsFor(theme).map((b) => b.id);

describe('the basemaps on offer', () => {
  it('lists each theme its own, light and dark ones apart, with satellite in both', () => {
    expect(ids('light')).toEqual(['light', 'streets', 'bright', 'satellite']);
    expect(ids('dark')).toEqual(['slate', 'charcoal', 'satellite']);
  });

  it('starts light mode on the light grey map and dark mode on Slate (OpenFreeMap Fiord)', () => {
    expect(defaultBasemap('light').style).toBe('https://tiles.openfreemap.org/styles/positron');
    expect(defaultBasemap('dark').id).toBe('slate');
    expect(defaultBasemap('dark').style).toBe('https://tiles.openfreemap.org/styles/fiord');
  });

  it('has unique ids and readable labels', () => {
    const all = BASEMAPS.map((b) => b.id);
    expect(new Set(all).size).toBe(all.length);
    for (const basemap of BASEMAPS) expect(basemap.label.length).toBeGreaterThan(2);
  });

  it('lifts only OpenFreeMap\'s near-black style, never Slate or the light maps', () => {
    expect(BASEMAPS.filter((b) => b.lift).map((b) => b.id)).toEqual(['charcoal']);
    expect(BASEMAPS.find((b) => b.id === 'charcoal')?.style).toBe('https://tiles.openfreemap.org/styles/dark');
  });

  it('serves every address over https', () => {
    for (const basemap of BASEMAPS) {
      const urls = typeof basemap.style === 'string'
        ? [basemap.style]
        : Object.values(basemap.style.sources).flatMap((source) => ('tiles' in source ? source.tiles ?? [] : []));
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe('the satellite basemap', () => {
  const satellite = BASEMAPS.find((b) => b.id === 'satellite');
  const style = typeof satellite?.style === 'object' ? satellite.style : undefined;

  it('credits its imagery source in the map\'s attribution', () => {
    const attributions = Object.values(style?.sources ?? {}).map((s) => ('attribution' in s ? s.attribution : undefined));
    expect(attributions.join(' ')).toContain('Esri');
  });

  it('has fonts for the group counts the stations draw on top of it', () => {
    expect(style?.glyphs).toContain('{fontstack}');
    expect(style?.glyphs).toContain('{range}');
  });

  it('draws imagery first and the place names above it', () => {
    expect(style?.layers.map((l) => l.id)).toEqual(['imagery', 'places']);
  });
});

describe('resolveBasemap', () => {
  it('returns the choice when the theme offers it', () => {
    expect(resolveBasemap('light', 'streets').id).toBe('streets');
    expect(resolveBasemap('dark', 'charcoal').id).toBe('charcoal');
    expect(resolveBasemap('dark', 'satellite').id).toBe('satellite');
  });

  it('falls back to the theme\'s default for a choice that belongs to the other theme', () => {
    expect(resolveBasemap('dark', 'streets').id).toBe('slate');
    expect(resolveBasemap('light', 'charcoal').id).toBe('light');
  });

  it('falls back to the default for an unknown or missing choice', () => {
    expect(resolveBasemap('light', 'gone').id).toBe('light');
    expect(resolveBasemap('dark', null).id).toBe('slate');
    expect(resolveBasemap('dark', undefined).id).toBe('slate');
  });
});

describe('styleOf', () => {
  it('passes an address through unchanged', () => {
    expect(styleOf(defaultBasemap('light'))).toBe('https://tiles.openfreemap.org/styles/positron');
  });

  it('gives a style defined here as a copy, so MapLibre can never change the original', () => {
    const satellite = BASEMAPS.find((b) => b.id === 'satellite');
    if (!satellite) throw new Error('missing');
    const copy = styleOf(satellite);
    expect(copy).toEqual(satellite.style);
    expect(copy).not.toBe(satellite.style);
  });
});
