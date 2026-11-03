// The basemaps a viewer can choose from. Each is offered only in the colour theme it suits, so the station circles,
// whose colours follow the theme, stay readable; satellite imagery suits both. The first of each theme is its default.
import type { StyleSpecification } from 'maplibre-gl';
import type { Theme } from './theme';

export interface Basemap {
  id: string;
  /** Short name for the selector. */
  label: string;
  themes: readonly Theme[];
  /** A style address, or a style defined here. */
  style: string | StyleSpecification;
  /** True for OpenFreeMap's near-black style, which is lifted to a readable slate as it loads (see map-style.ts). */
  lift?: boolean;
}

const OPENFREEMAP = 'https://tiles.openfreemap.org/styles';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

/** Aerial imagery with Esri's place and boundary names on top. Fonts come from OpenFreeMap, like the other styles'. */
const SATELLITE: StyleSpecification = {
  version: 8,
  name: 'Satellite',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    imagery: {
      type: 'raster',
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community',
    },
    places: {
      type: 'raster',
      tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'places', type: 'raster', source: 'places' },
  ],
};

export const BASEMAPS: readonly Basemap[] = [
  { id: 'light', label: 'Light grey', themes: ['light'], style: `${OPENFREEMAP}/positron` },
  { id: 'streets', label: 'Streets', themes: ['light'], style: `${OPENFREEMAP}/liberty` },
  { id: 'bright', label: 'Bright', themes: ['light'], style: `${OPENFREEMAP}/bright` },
  { id: 'slate', label: 'Slate', themes: ['dark'], style: `${OPENFREEMAP}/fiord` },
  { id: 'charcoal', label: 'Charcoal', themes: ['dark'], style: `${OPENFREEMAP}/dark`, lift: true },
  { id: 'satellite', label: 'Satellite', themes: ['light', 'dark'], style: SATELLITE },
];

/** The basemaps offered in a theme, in the order they are listed. */
export function basemapsFor(theme: Theme): Basemap[] {
  return BASEMAPS.filter((basemap) => basemap.themes.includes(theme));
}

/** The basemap a theme starts with. */
export function defaultBasemap(theme: Theme): Basemap {
  const [first] = basemapsFor(theme);
  if (!first) throw new Error(`No basemap is offered in the ${theme} theme`);
  return first;
}

/** The basemap with this id if the theme offers it, otherwise the theme's default (an old or unknown saved choice). */
export function resolveBasemap(theme: Theme, id: string | null | undefined): Basemap {
  return basemapsFor(theme).find((basemap) => basemap.id === id) ?? defaultBasemap(theme);
}

/** What to give MapLibre: the address as it is, or a copy of a style defined here so the original is never shared. */
export function styleOf(basemap: Basemap): string | StyleSpecification {
  return typeof basemap.style === 'string' ? basemap.style : structuredClone(basemap.style);
}

const storageKey = (theme: Theme): string => `basemap-${theme}`;

/** The viewer's saved choice for a theme, or null when none is saved or storage is blocked. */
export function savedBasemapId(theme: Theme): string | null {
  try {
    return localStorage.getItem(storageKey(theme));
  } catch {
    return null;
  }
}

export function saveBasemapId(theme: Theme, id: string): void {
  try {
    localStorage.setItem(storageKey(theme), id);
  } catch {
    // Storage is blocked: the choice lasts for this visit only.
  }
}

/** The basemap to show now in a theme: the viewer's saved choice, else the default. */
export function chosenBasemap(theme: Theme): Basemap {
  return resolveBasemap(theme, savedBasemapId(theme));
}
