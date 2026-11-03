import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INK, PAPER, contrastRatio, luminance, textOn,
} from './contrast';

describe('contrast', () => {
  it('knows black and white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 10);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('does not care which colour is passed first', () => {
    expect(contrastRatio('#f2c230', INK)).toBeCloseTo(contrastRatio(INK, '#f2c230'), 10);
  });

  it('picks ink on light fills and white on dark ones', () => {
    expect(textOn('#f2c230')).toBe(INK);
    expect(textOn('#ffffff')).toBe(INK);
    expect(textOn('#6b2d8e')).toBe(PAPER);
    expect(textOn('#000000')).toBe(PAPER);
  });

  it('rejects anything that is not #rrggbb', () => {
    expect(() => luminance('red')).toThrow('#rrggbb');
    expect(() => luminance('#fff')).toThrow('#rrggbb');
  });
});

/** The group circles' colours live in the stylesheet; every one of them must carry readable text in both themes. */
describe('station group colours (from styles.css)', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  const colours = (block: string): string[] => [1, 2, 3, 4].map((n) => {
    const match = new RegExp(`--cluster-${n}:\\s*(#[0-9a-fA-F]{6})`).exec(block);
    if (!match) throw new Error(`--cluster-${n} is missing`);
    return match[1] as string;
  });
  const light = colours(css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)')));
  const dark = colours(css.slice(css.indexOf(':root[data-theme="dark"] {')));

  it.each([['light', light], ['dark', dark]])('every %s colour has text at least 4.5:1 against it', (_theme, fills) => {
    for (const fill of fills) {
      expect(contrastRatio(fill, textOn(fill)), fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([['light', light], ['dark', dark]])('the %s colours are four different colours that get darker with size', (_theme, fills) => {
    expect(new Set(fills).size).toBe(4);
    const lum = fills.map(luminance);
    expect(lum).toEqual([...lum].sort((a, b) => (b as number) - (a as number)));
  });
});
