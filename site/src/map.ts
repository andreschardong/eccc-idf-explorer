// MapLibre GL map: one GPU-drawn circle per station, coloured by record length or 100-year design depth.
// The basemap is OpenFreeMap (free vector tiles, no API key); the style flips with the colour theme.
import type { FeatureCollection, Point } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre runs tile parsing in a web worker that ships as its own file. Importing it as a URL makes
// Vite copy it into the build and gives MapLibre the right address in dev and production alike.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {
  RECORD_LENGTH_BREAKS, binLabels, quantileBreaks,
} from './binning';
import { prettyName } from './format';
import { cssVar, currentTheme } from './theme';
import type { StationSummary } from './types';

export type ColorMode = 'years' | 'd1h' | 'd24h';

export interface LegendInfo {
  title: string;
  unit: string;
  /** One entry per class, lightest first in light mode. */
  classes: { label: string; color: string }[];
  /** Break values between classes, for tick labels. */
  breaks: number[];
  /** Colour for stations without a value, or null when every station has one. */
  missingColor: string | null;
}

export interface StationMap {
  setMode(mode: ColorMode): void;
  setProvince(code: string): void;
  select(id: string | null, options?: { pan?: boolean }): void;
  refreshTheme(): void;
}

export interface MapHandlers {
  onSelect(id: string): void;
  onLegend(info: LegendInfo): void;
}

const STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

const CANADA_BOUNDS: maplibregl.LngLatBoundsLike = [[-141.5, 41.5], [-52, 75]];
const SOURCE = 'stations';
const LAYER = 'stations';
const HOVER = 'stations-hover';
const SELECTED = 'stations-selected';
const HALO = 'stations-selected-halo';

const MODES: Record<ColorMode, { title: string; unit: string; property: 'years' | 'd1h' | 'd24h' }> = {
  years: { title: 'Years of record', unit: 'yr', property: 'years' },
  d1h: { title: '100-year, 1-hour depth', unit: 'mm', property: 'd1h' },
  d24h: { title: '100-year, 24-hour depth', unit: 'mm', property: 'd24h' },
};

type CircleRadius = maplibregl.ExpressionSpecification;

/** Circle radius that grows with zoom; `extra` pixels are added for rings and halos. */
function radius(extra: number): CircleRadius {
  return ['interpolate', ['linear'], ['zoom'], 3, 3.5 + extra, 5, 5 + extra, 8, 7.5 + extra, 11, 10 + extra];
}

function toFeatures(stations: readonly StationSummary[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: stations.map((station) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [station.lon, station.lat] },
      properties: {
        id: station.id,
        name: station.name,
        province: station.province,
        years: station.years,
        // Missing properties are left out so the `has` test in the colour expression sees them as missing.
        ...(station.depth100Yr1h === undefined ? {} : { d1h: station.depth100Yr1h }),
        ...(station.depth100Yr24h === undefined ? {} : { d24h: station.depth100Yr24h }),
      },
    })),
  };
}

export function createMap(
  element: HTMLElement,
  stations: readonly StationSummary[],
  { onSelect, onLegend }: MapHandlers,
): StationMap {
  maplibregl.setWorkerUrl(workerUrl);
  const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byId = new Map(stations.map((station) => [station.id, station]));
  const state = {
    mode: 'years' as ColorMode,
    province: '',
    selected: null as string | null,
    hover: null as string | null,
    theme: currentTheme(),
  };

  const map = new maplibregl.Map({
    container: element,
    style: STYLE_URLS[state.theme],
    bounds: CANADA_BOUNDS,
    fitBoundsOptions: { padding: 24 },
    minZoom: 2.5,
    maxZoom: 13,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.touchZoomRotate.disableRotation();

  const popup = new maplibregl.Popup({
    closeButton: false, closeOnClick: false, offset: 12, className: 'station-popup', maxWidth: '260px',
  });
  const features = toFeatures(stations);

  /** The colour expression for the current mode, with class colours read from the CSS tokens. */
  function colourExpression(): { expression: maplibregl.ExpressionSpecification; legend: LegendInfo } {
    const mode = MODES[state.mode];
    const values = stations.map((s) => (mode.property === 'years' ? s.years : mode.property === 'd1h' ? s.depth100Yr1h : s.depth100Yr24h));
    const breaks = mode.property === 'years' ? [...RECORD_LENGTH_BREAKS] : quantileBreaks(values, 5);
    const colours = [1, 2, 3, 4, 5].map((n) => cssVar(`--bin-${n}`));
    const none = cssVar('--bin-none');
    // ['step', input, colour0, break1, colour1, break2, colour2, ...] has a variable length that
    // the style-spec tuple types cannot express, so it is assembled as a list and cast once.
    const stops = breaks.flatMap((b, i) => [b, colours[Math.min(i + 1, colours.length - 1)] as string]);
    const step = ['step', ['get', mode.property], colours[0] as string, ...stops] as unknown as maplibregl.ExpressionSpecification;
    const expression: maplibregl.ExpressionSpecification = ['case', ['has', mode.property], step, none];
    const labels = binLabels(breaks, mode.unit);
    return {
      expression,
      legend: {
        title: mode.title,
        unit: mode.unit,
        classes: labels.map((label, i) => ({ label, color: colours[Math.min(i, colours.length - 1)] as string })),
        breaks,
        missingColor: values.some((v) => v === undefined || v === null) ? none : null,
      },
    };
  }

  function idFilter(id: string | null): maplibregl.FilterSpecification {
    return ['==', ['get', 'id'], id ?? ''];
  }

  function addStationLayers(): void {
    if (map.getSource(SOURCE)) return;
    map.addSource(SOURCE, { type: 'geojson', data: features });
    const { expression } = colourExpression();
    map.addLayer({
      id: HALO,
      type: 'circle',
      source: SOURCE,
      filter: idFilter(state.selected),
      paint: { 'circle-radius': radius(9), 'circle-color': cssVar('--accent'), 'circle-opacity': 0.22 },
    });
    map.addLayer({
      id: LAYER,
      type: 'circle',
      source: SOURCE,
      paint: {
        'circle-radius': radius(0),
        'circle-color': expression,
        'circle-stroke-width': 1.75,
        'circle-stroke-color': cssVar('--map-ring'),
      },
    });
    map.addLayer({
      id: HOVER,
      type: 'circle',
      source: SOURCE,
      filter: idFilter(state.hover),
      paint: {
        'circle-radius': radius(3), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--ink'),
      },
    });
    map.addLayer({
      id: SELECTED,
      type: 'circle',
      source: SOURCE,
      filter: idFilter(state.selected),
      paint: {
        'circle-radius': radius(4), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 3, 'circle-stroke-color': cssVar('--ink'),
      },
    });
    applyState();
  }

  function applyState(): void {
    if (!map.getLayer(LAYER)) return;
    const { expression, legend } = colourExpression();
    map.setPaintProperty(LAYER, 'circle-color', expression);
    map.setPaintProperty(LAYER, 'circle-stroke-color', cssVar('--map-ring'));
    map.setPaintProperty(HALO, 'circle-color', cssVar('--accent'));
    map.setPaintProperty(HOVER, 'circle-stroke-color', cssVar('--ink'));
    map.setPaintProperty(SELECTED, 'circle-stroke-color', cssVar('--ink'));
    map.setFilter(LAYER, state.province ? ['==', ['get', 'province'], state.province] : null);
    map.setFilter(HALO, idFilter(state.selected));
    map.setFilter(SELECTED, idFilter(state.selected));
    map.setFilter(HOVER, idFilter(state.hover));
    onLegend(legend);
  }

  map.on('style.load', addStationLayers);

  map.on('mousemove', LAYER, (event: maplibregl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;
    map.getCanvas().style.cursor = 'pointer';
    const id = String(feature.properties?.['id']);
    const station = byId.get(id);
    if (!station) return;
    if (state.hover !== id) {
      state.hover = id;
      if (map.getLayer(HOVER)) map.setFilter(HOVER, idFilter(id));
    }
    const name = document.createElement('strong');
    name.textContent = prettyName(station.name);
    const detail = document.createElement('span');
    detail.textContent = `${station.province} · ${station.years} years of record`;
    const box = document.createElement('div');
    box.append(name, detail);
    popup.setLngLat([station.lon, station.lat]).setDOMContent(box).addTo(map);
  });
  map.on('mouseleave', LAYER, () => {
    map.getCanvas().style.cursor = '';
    state.hover = null;
    if (map.getLayer(HOVER)) map.setFilter(HOVER, idFilter(null));
    popup.remove();
  });
  map.on('click', LAYER, (event: maplibregl.MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.['id'];
    if (typeof id === 'string') onSelect(id);
  });

  return {
    setMode(mode) {
      state.mode = mode;
      applyState();
    },
    setProvince(code) {
      state.province = code;
      applyState();
      const subset = stations.filter((s) => !code || s.province === code);
      if (subset.length === 0) return;
      const bounds = new maplibregl.LngLatBounds();
      subset.forEach((s) => bounds.extend([s.lon, s.lat]));
      map.fitBounds(bounds, { padding: 56, maxZoom: 8, animate: !reducedMotion() });
    },
    select(id, { pan = true } = {}) {
      state.selected = id;
      applyState();
      const station = id ? byId.get(id) : undefined;
      if (station && pan) {
        const target = { center: [station.lon, station.lat] as [number, number], zoom: Math.max(map.getZoom(), 6.5) };
        if (reducedMotion()) map.jumpTo(target);
        else map.flyTo({ ...target, duration: 900, essential: false });
      }
    },
    refreshTheme() {
      const theme = currentTheme();
      if (theme === state.theme) {
        applyState();
        return;
      }
      state.theme = theme;
      // Replacing the style drops our source and layers; `style.load` puts them back.
      map.setStyle(STYLE_URLS[theme]);
    },
  };
}
