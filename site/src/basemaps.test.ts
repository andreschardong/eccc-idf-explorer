import { describe, expect, it } from 'vitest';
import {
  BASEMAPS, basemapsFor, defaultBasemap, resolveBasemap,
} from './basemaps';

const ids = (theme: 'light' | 'dark'): string[] => basemapsFor(theme).map((b) => b.id);

describe('the basemaps on offer', () => {
  it('lists each theme its own, light and dark ones apart', () => {
    expect(ids('light')).toEqual(['light', 'streets', 'bright']);
    expect(ids('dark')).toEqual(['slate', 'charcoal']);
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

  it('uses only OpenFreeMap, the one provider that needs no key, account or licence', () => {
    for (const basemap of BASEMAPS) expect(basemap.style).toMatch(/^https:\/\/tiles\.openfreemap\.org\/styles\//);
  });
});

describe('resolveBasemap', () => {
  it('returns the choice when the theme offers it', () => {
    expect(resolveBasemap('light', 'streets').id).toBe('streets');
    expect(resolveBasemap('dark', 'charcoal').id).toBe('charcoal');
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
