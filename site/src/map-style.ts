// OpenFreeMap's dark style is almost black (land is rgb(12,12,12)), which swallows the roads, coastlines and place
// names the stations are read against. This lifts it to a dark slate when the style loads: surfaces get lighter and a
// little blue, labels get light, label halos stay dark. Pure functions, no DOM.
import type { StyleSpecification } from 'maplibre-gl';

export interface Hsla {
  /** Degrees, 0 to 360. */
  h: number;
  /** 0 to 1. */
  s: number;
  /** 0 to 1. */
  l: number;
  /** 0 to 1. */
  a: number;
}

export type ColourRole = 'surface' | 'water' | 'text' | 'halo';

/** Lightness the darkest surface is lifted to, and how much of the original lightness is kept on top of that. */
export const SURFACE_FLOOR = 0.27;
const SURFACE_SLOPE = 0.5;
const SLATE_HUE = 215;
const SLATE_SATURATION = 0.12;
const WATER_SATURATION = 0.3;
/** Labels are at least this light; halos at most 0.2 so the label keeps an outline of the right kind. */
const TEXT_FLOOR = 0.74;
const HALO_CEILING = 0.2;

const clamp = (value: number, low = 0, high = 1): number => Math.min(high, Math.max(low, value));

function fromRgb(r: number, g: number, b: number, a: number): Hsla {
  const [red, green, blue] = [r, g, b].map((v) => clamp(v / 255)) as [number, number, number];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l, a };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === red ? ((green - blue) / d) % 6 : max === green ? (blue - red) / d + 2 : (red - green) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l, a };
}

/** Reads a CSS colour in the forms the OpenFreeMap styles use: #rgb, #rrggbb, rgb(a)() and hsl(a)(). Null otherwise. */
export function parseColour(text: string): Hsla | null {
  const value = text.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return fromRgb(parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), 1);
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgb) return fromRgb(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : clamp(Number(rgb[4])));
  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (hsl) {
    return {
      h: Number(hsl[1]) % 360, s: clamp(Number(hsl[2]) / 100), l: clamp(Number(hsl[3]) / 100), a: hsl[4] === undefined ? 1 : clamp(Number(hsl[4])),
    };
  }
  return null;
}

function format({ h, s, l, a }: Hsla): string {
  return `hsla(${h.toFixed(0)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%, ${Number(a.toFixed(3))})`;
}

/** The lifted colour for one style colour, in the role it plays; the text unchanged if it is not a colour. */
export function liftColour(text: string, role: ColourRole): string {
  const colour = parseColour(text);
  if (!colour) return text;
  switch (role) {
    case 'text':
      return format({ ...colour, h: SLATE_HUE, s: Math.min(colour.s, 0.1), l: Math.max(colour.l, TEXT_FLOOR) });
    case 'halo':
      return format({ ...colour, h: SLATE_HUE, s: SLATE_SATURATION, l: Math.min(HALO_CEILING, colour.l * 0.4 + 0.08) });
    case 'water':
      return format({ ...colour, h: SLATE_HUE, s: WATER_SATURATION, l: SURFACE_FLOOR + SURFACE_SLOPE * colour.l - 0.04 });
    case 'surface':
      return format({ ...colour, h: SLATE_HUE, s: Math.max(colour.s, SLATE_SATURATION), l: SURFACE_FLOOR + SURFACE_SLOPE * colour.l });
  }
}

/** Every colour string inside a paint value, which may be a plain colour or an expression such as `interpolate`. */
function liftValue(value: unknown, role: ColourRole): unknown {
  if (typeof value === 'string') return liftColour(value, role);
  if (Array.isArray(value)) return value.map((item) => liftValue(item, role));
  return value;
}

function roleOf(property: string, layerId: string): ColourRole {
  if (property === 'text-color') return 'text';
  if (property === 'text-halo-color') return 'halo';
  return layerId.startsWith('water') ? 'water' : 'surface';
}

/** A copy of an OpenFreeMap dark style with every layer's colours lifted. The input is not changed. */
export function brightenDarkStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const paint = (layer as { paint?: Record<string, unknown> }).paint;
      if (!paint) return layer;
      const lifted = Object.fromEntries(Object.entries(paint).map(([property, value]) => [
        property,
        property.endsWith('-color') ? liftValue(value, roleOf(property, layer.id)) : value,
      ]));
      return { ...layer, paint: lifted } as typeof layer;
    }),
  };
}
