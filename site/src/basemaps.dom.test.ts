// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chosenBasemap, saveBasemapId, savedBasemapId } from './basemaps';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('the remembered basemap', () => {
  it('is the theme\'s default until the viewer chooses', () => {
    expect(chosenBasemap('light').id).toBe('light');
    expect(chosenBasemap('dark').id).toBe('slate');
  });

  it('remembers a choice for the theme it was made in, and only that theme', () => {
    saveBasemapId('light', 'streets');
    expect(chosenBasemap('light').id).toBe('streets');
    expect(chosenBasemap('dark').id).toBe('slate');
    saveBasemapId('dark', 'charcoal');
    expect(chosenBasemap('dark').id).toBe('charcoal');
    expect(chosenBasemap('light').id).toBe('streets');
  });

  it('ignores a saved id that is no longer on offer in that theme', () => {
    localStorage.setItem('basemap-dark', 'streets');
    expect(chosenBasemap('dark').id).toBe('slate');
    localStorage.setItem('basemap-light', 'removed-long-ago');
    expect(chosenBasemap('light').id).toBe('light');
  });

  it('falls back to the default for a choice that has since been removed, such as the old satellite map', () => {
    localStorage.setItem('basemap-light', 'satellite');
    localStorage.setItem('basemap-dark', 'satellite');
    expect(chosenBasemap('light').id).toBe('light');
    expect(chosenBasemap('dark').id).toBe('slate');
  });

  it('keeps working, on the default, when storage is blocked', () => {
    const blocked = (): never => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(savedBasemapId('light')).toBeNull();
    expect(() => saveBasemapId('light', 'streets')).not.toThrow();
    expect(chosenBasemap('light').id).toBe('light');
  });
});
