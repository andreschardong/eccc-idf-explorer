import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import {
  SURFACE_FLOOR, brightenDarkStyle, liftColour, parseColour,
} from './map-style';

const approx = (actual: number, expected: number, digits = 2): void => expect(actual).toBeCloseTo(expected, digits);

describe('parseColour', () => {
  it('reads the colour forms the OpenFreeMap styles use', () => {
    approx(parseColour('#000')?.l ?? -1, 0);
    approx(parseColour('#181818')?.l ?? -1, 24 / 255);
    approx(parseColour('rgb(12,12,12)')?.l ?? -1, 12 / 255);
    approx(parseColour('hsl(0,2%,5%)')?.l ?? -1, 0.05);
    approx(parseColour('hsla(0,0%,85%,0.53)')?.a ?? -1, 0.53);
    approx(parseColour('rgba(60,60,60,0.8)')?.a ?? -1, 0.8);
  });

  it('tolerates the stray space before a comma that the dark style has', () => {
    approx(parseColour('rgb(27 ,27 ,29)')?.l ?? -1, 28 / 255, 1);
  });

  it('returns null for text that is not a colour', () => {
    expect(parseColour('interpolate')).toBeNull();
    expect(parseColour('zoom')).toBeNull();
    expect(parseColour('wood-pattern')).toBeNull();
  });
});

describe('liftColour', () => {
  it('lifts the near-black land to a dark slate that is no longer black', () => {
    const land = parseColour(liftColour('rgb(12,12,12)', 'surface'));
    expect(land?.l).toBeGreaterThanOrEqual(SURFACE_FLOOR);
    expect(land?.l).toBeLessThan(0.4);
    expect(land?.h).toBeCloseTo(215, 0);
  });

  it('keeps the order between surfaces: lighter stays lighter', () => {
    const lightness = (text: string): number => parseColour(liftColour(text, 'surface'))?.l ?? -1;
    expect(lightness('#000')).toBeLessThan(lightness('rgb(12,12,12)'));
    expect(lightness('rgb(12,12,12)')).toBeLessThan(lightness('rgb(32,32,32)'));
    expect(lightness('rgb(32,32,32)')).toBeLessThan(lightness('hsl(0,0%,37%)'));
  });

  it('makes water bluer than land, and darker than it for the same source colour', () => {
    const land = parseColour(liftColour('rgb(27,27,29)', 'surface'));
    const water = parseColour(liftColour('rgb(27,27,29)', 'water'));
    expect(water?.s).toBeGreaterThan(land?.s ?? 1);
    expect(water?.l).toBeLessThan(land?.l ?? 0);
  });

  it('makes labels light enough to read against the lifted land, and their halos dark', () => {
    const land = parseColour(liftColour('rgb(12,12,12)', 'surface'));
    const text = parseColour(liftColour('rgb(101,101,101)', 'text'));
    const halo = parseColour(liftColour('rgba(0,0,0,0.7)', 'halo'));
    expect((text?.l ?? 0) - (land?.l ?? 1)).toBeGreaterThan(0.4);
    expect(halo?.l).toBeLessThan(land?.l ?? 0);
  });

  it('turns even black label text light, so labels drawn in black on a grey halo stay readable', () => {
    expect(parseColour(liftColour('hsla(0,0%,0%,0.7)', 'text'))?.l).toBeGreaterThan(0.7);
  });

  it('keeps transparency', () => {
    approx(parseColour(liftColour('rgba(60,60,60,0.8)', 'surface'))?.a ?? -1, 0.8);
    approx(parseColour(liftColour('hsla(0,0%,85%,0.53)', 'surface'))?.a ?? -1, 0.53);
  });

  it('leaves text that is not a colour exactly as it was', () => {
    expect(liftColour('linear', 'surface')).toBe('linear');
  });
});

const style = (layers: unknown[]): StyleSpecification => ({ version: 8, sources: {}, layers } as unknown as StyleSpecification);

describe('brightenDarkStyle', () => {
  const source = style([
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
    { id: 'water', type: 'fill', source: 's', paint: { 'fill-color': 'rgb(27 ,27 ,29)', 'fill-antialias': false } },
    {
      id: 'road', type: 'line', source: 's',
      paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5.8, 'hsla(0,0%,85%,0.53)', 6, '#000'], 'line-width': 2 },
    },
    {
      id: 'place', type: 'symbol', source: 's',
      layout: { 'text-field': '{name}' },
      paint: { 'text-color': 'rgb(101,101,101)', 'text-halo-color': 'rgba(0,0,0,0.7)' },
    },
    { id: 'no-paint', type: 'fill', source: 's' },
  ]);
  const result = brightenDarkStyle(source);
  const paintOf = (id: string): Record<string, unknown> => (result.layers.find((l) => l.id === id) as { paint: Record<string, unknown> }).paint;

  it('lifts a plain colour and treats water as water', () => {
    expect(parseColour(paintOf('background')['background-color'] as string)?.l).toBeGreaterThanOrEqual(SURFACE_FLOOR);
    const water = parseColour(paintOf('water')['fill-color'] as string);
    expect(water?.s).toBeGreaterThan(0.2);
  });

  it('lifts the colours inside an expression and leaves its keywords alone', () => {
    const expression = paintOf('road')['line-color'] as unknown[];
    expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
    expect(expression[3]).toBe(5.8);
    expect(parseColour(expression[4] as string)?.l).toBeGreaterThan(0.6);
    expect(parseColour(expression[6] as string)?.l).toBeGreaterThanOrEqual(SURFACE_FLOOR);
  });

  it('leaves every other property alone', () => {
    expect(paintOf('water')['fill-antialias']).toBe(false);
    expect(paintOf('road')['line-width']).toBe(2);
    expect((result.layers.find((l) => l.id === 'place') as { layout: unknown }).layout).toEqual({ 'text-field': '{name}' });
  });

  it('gives labels light text and dark halos', () => {
    const place = paintOf('place');
    expect(parseColour(place['text-color'] as string)?.l).toBeGreaterThan(0.7);
    expect(parseColour(place['text-halo-color'] as string)?.l).toBeLessThan(0.2);
  });

  it('keeps layers without paint, and does not change the style it was given', () => {
    expect(result.layers).toHaveLength(source.layers.length);
    expect(result.layers.find((l) => l.id === 'no-paint')).toEqual(source.layers.find((l) => l.id === 'no-paint'));
    expect((source.layers[0] as unknown as { paint: Record<string, string> }).paint['background-color']).toBe('rgb(12,12,12)');
  });
});

describe('the real OpenFreeMap dark style', () => {
  it('no longer has a near-black land colour', async () => {
    const { default: real } = await import('./test-data/openfreemap-dark.json');
    const lifted = brightenDarkStyle(real as unknown as StyleSpecification);
    const background = lifted.layers.find((l) => l.id === 'background') as unknown as { paint: Record<string, string> };
    expect(parseColour(background.paint['background-color'] ?? '')?.l).toBeGreaterThanOrEqual(SURFACE_FLOOR);
    const colours = JSON.stringify(lifted.layers).match(/hsla\([^)]*\)/g) ?? [];
    expect(colours.length).toBeGreaterThan(40);
    const darkest = Math.min(...colours.map((c) => parseColour(c)?.l ?? 1));
    expect(darkest).toBeGreaterThanOrEqual(0.08);
  });
});
