// IDF curves: rainfall intensity (or depth) against duration, one curve per return period, log-log.
import { clear, h, observeWidth, s } from './dom';
import {
  durationAxisLabel, durationLabel, formatValue, prettyName, returnPeriodLabel,
} from './format';
import {
  logScale, nice125Down, nice125Up, spreadLabels, ticks125,
} from './scales';
import type { StationDetail } from './types';

export type IdfMode = 'intensity' | 'depth';

export interface IdfOptions {
  mode: IdfMode;
  /** Return period (years) whose 95 % confidence band is drawn, or null for none. */
  ciPeriod: number | null;
}

export interface ChartController<T> {
  update(next: Partial<T>): void;
  destroy(): void;
}

const MARGIN = {
  top: 14, right: 62, bottom: 44, left: 50,
};
const LABEL_GAP = 13;
const MIN_LABEL_SPACING = 26;
const RAMP_STEPS = 7;

/** Spreads n series over the 7-step ramp; with exactly 7 return periods this is the identity. */
export function colourIndex(p: number, count: number): number {
  if (count <= 1) return RAMP_STEPS - 1;
  return Math.round((p / (count - 1)) * (RAMP_STEPS - 1));
}

/** Renders the chart into `container`. */
export function renderIdfChart(
  container: HTMLElement,
  station: StationDetail,
  initial: Partial<IdfOptions> = {},
): ChartController<IdfOptions> {
  const state: IdfOptions = { mode: 'intensity', ciPeriod: null, ...initial };
  let width = 0;
  let activeIndex: number | null = null;

  const legend = h('ul', { class: 'legend-inline', 'aria-label': 'Return periods' },
    station.returnPeriods.map((years, p) => h('li', { class: `c${colourIndex(p, station.returnPeriods.length)}` },
      h('i'), returnPeriodLabel(years))));
  const area = h('div', { class: 'chart' });
  clear(container).append(legend, area);

  const value = (d: number, p: number): number | null => (state.mode === 'depth' ? station.depths[d]?.[p] : station.rates[d]?.[p]) ?? null;
  const halfWidth = (d: number, p: number): number | null => {
    const ci = station.confidence[d]?.[p] ?? null;
    if (ci === null) return null;
    return state.mode === 'depth' ? ci * ((station.durations[d] as number) / 60) : ci;
  };

  function describe(): string {
    const p100 = station.returnPeriods.indexOf(100);
    const p = p100 < 0 ? station.returnPeriods.length - 1 : p100;
    const lastD = station.durations.length - 1;
    const first = station.durations.findIndex((_, d) => station.rates[d]?.[p] != null);
    const from = first >= 0 ? station.rates[first]?.[p] : null;
    const to = station.rates[lastD]?.[p];
    return `IDF curves for ${prettyName(station.name)}: ${station.returnPeriods.length} return periods from ${station.returnPeriods[0]} to ${station.returnPeriods[station.returnPeriods.length - 1]} years, plotted on log-log axes. `
      + `The ${station.returnPeriods[p]}-year intensity falls from ${formatValue(from)} mm/h at ${first >= 0 ? durationLabel(station.durations[first] as number) : 'the shortest duration'} to ${formatValue(to)} mm/h at ${durationLabel(station.durations[lastD] as number)}. `
      + 'Use the left and right arrow keys to read values by duration. The Tables tab holds the same numbers.';
  }

  function buildSvg(): SVGSVGElement {
    const { durations, returnPeriods } = station;
    const unit = state.mode === 'depth' ? 'mm' : 'mm/h';
    const height = Math.round(Math.min(460, Math.max(300, width * 0.78)));
    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;
    const xMin = durations[0] as number;
    const xMax = durations[durations.length - 1] as number;
    const x = logScale(xMin, xMax, MARGIN.left, MARGIN.left + plotW);
    const bandP = state.ciPeriod === null ? -1 : returnPeriods.indexOf(state.ciPeriod);

    const all: number[] = [];
    durations.forEach((_, d) => returnPeriods.forEach((__, p) => {
      const v = value(d, p);
      if (v !== null) all.push(v);
    }));
    if (bandP >= 0) {
      durations.forEach((_, d) => {
        const v = value(d, bandP);
        const w = halfWidth(d, bandP);
        if (v !== null && w !== null && v - w > 0) all.push(v - w, v + w);
      });
    }
    const yLo = nice125Down(Math.min(...all) * 0.9);
    const yHi = nice125Up(Math.max(...all) * 1.08);
    const y = logScale(yLo, yHi, MARGIN.top + plotH, MARGIN.top);

    const svg = s('svg', {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'img',
      tabindex: 0,
      'aria-label': describe(),
    });

    // Grid and axes.
    for (const tick of ticks125(yLo, yHi)) {
      svg.append(
        s('line', { class: 'grid', x1: MARGIN.left, x2: MARGIN.left + plotW, y1: y(tick), y2: y(tick) }),
        s('text', { x: MARGIN.left - 8, y: y(tick), dy: '0.32em', 'text-anchor': 'end' }, tick.toLocaleString('en-CA')),
      );
    }
    let lastLabelX = Number.NEGATIVE_INFINITY;
    for (const minutes of durations) {
      svg.append(s('line', { class: 'grid', x1: x(minutes), x2: x(minutes), y1: MARGIN.top, y2: MARGIN.top + plotH }));
      // On narrow screens the 10 and 15 minute labels would overlap; the grid line stays, the label yields.
      if (x(minutes) - lastLabelX >= MIN_LABEL_SPACING) {
        svg.append(s('text', { x: x(minutes), y: MARGIN.top + plotH + 16, 'text-anchor': 'middle' }, durationAxisLabel(minutes)));
        lastLabelX = x(minutes);
      }
    }
    svg.append(
      s('line', { class: 'axis', x1: MARGIN.left, x2: MARGIN.left + plotW, y1: MARGIN.top + plotH, y2: MARGIN.top + plotH }),
      s('text', { class: 'axis-title', x: MARGIN.left + plotW / 2, y: height - 6, 'text-anchor': 'middle' }, 'Storm duration (m = minutes, h = hours)'),
      s('text', {
        class: 'axis-title',
        transform: `translate(14 ${MARGIN.top + plotH / 2}) rotate(-90)`,
        'text-anchor': 'middle',
      }, state.mode === 'depth' ? 'Rainfall depth (mm)' : 'Rainfall intensity (mm/h)'),
    );

    // Durations ECCC did not analyse at the start of the range: say so on the plot, not only in a note.
    const firstData = durations.findIndex((_, d) => returnPeriods.some((__, p) => value(d, p) !== null));
    if (firstData > 0) {
      const edge = x(durations[firstData] as number);
      svg.append(
        s('rect', { class: 'gap', x: MARGIN.left, y: MARGIN.top, width: edge - MARGIN.left - 4, height: plotH }),
        s('text', { class: 'gap-label', x: (MARGIN.left + edge - 4) / 2, y: MARGIN.top + plotH / 2, 'text-anchor': 'middle' }, 'Not analysed'),
      );
    }

    // 95 % confidence band for one return period.
    if (bandP >= 0) {
      const upper: [number, number][] = [];
      const lower: [number, number][] = [];
      durations.forEach((minutes, d) => {
        const v = value(d, bandP);
        const w = halfWidth(d, bandP);
        if (v === null || w === null) return;
        upper.push([x(minutes), y(v + w)]);
        lower.push([x(minutes), y(Math.max(v - w, yLo))]);
      });
      if (upper.length > 1) {
        const outline = [...upper, ...lower.reverse()];
        const path = `${outline.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('')}Z`;
        svg.append(s('path', { class: `band c${colourIndex(bandP, returnPeriods.length)}`, d: path }));
      }
    }

    // Curves, drawn from the shortest return period up so the longest sits on top.
    const ends: { years: number; cls: string; px: number; py: number }[] = [];
    returnPeriods.forEach((years, p) => {
      const cls = `c${colourIndex(p, returnPeriods.length)}`;
      let path = '';
      let pen = false;
      let last: { px: number; py: number } | null = null;
      durations.forEach((minutes, d) => {
        const v = value(d, p);
        if (v === null) {
          pen = false;
          return;
        }
        path += `${pen ? 'L' : 'M'}${x(minutes).toFixed(1)} ${y(v).toFixed(1)}`;
        pen = true;
        last = { px: x(minutes), py: y(v) };
      });
      svg.append(s('path', { class: `line ${cls}`, d: path }));
      durations.forEach((minutes, d) => {
        const v = value(d, p);
        if (v !== null) svg.append(s('circle', { class: `dot ${cls}`, cx: x(minutes), cy: y(v), r: 3.5 }));
      });
      if (last) ends.push({ years, cls, ...(last as { px: number; py: number }) });
    });

    // Direct labels at the right-hand end of each curve, nudged apart where curves bunch up.
    const spread = spreadLabels(ends.map((e) => e.py), LABEL_GAP, MARGIN.top + 4, MARGIN.top + plotH);
    ends.forEach((end, i) => {
      svg.append(s('text', { class: `end-label ${end.cls}`, x: end.px + 8, y: spread[i], dy: '0.32em' }, `${end.years}-yr`));
    });

    // Hover and keyboard layer.
    const cursor = s('line', { class: 'cursor', y1: MARGIN.top, y2: MARGIN.top + plotH, visibility: 'hidden' });
    const highlights = s('g');
    const overlay = s('rect', { x: MARGIN.left, y: MARGIN.top, width: plotW, height: plotH, fill: 'transparent' });
    svg.append(cursor, highlights, overlay);
    const tip = h('div', { class: 'chart-tip', hidden: true });
    area.append(tip);

    const nearest = (clientX: number): number => {
      const box = svg.getBoundingClientRect();
      const px = ((clientX - box.left) / box.width) * width;
      let best = 0;
      durations.forEach((minutes, d) => {
        if (Math.abs(x(minutes) - px) < Math.abs(x(durations[best] as number) - px)) best = d;
      });
      return best;
    };

    const show = (d: number): void => {
      activeIndex = d;
      const px = x(durations[d] as number);
      cursor.setAttribute('x1', String(px));
      cursor.setAttribute('x2', String(px));
      cursor.setAttribute('visibility', 'visible');
      clear(highlights);
      const rows: HTMLElement[] = [];
      returnPeriods.forEach((years, p) => {
        const v = value(d, p);
        if (v === null) return;
        const cls = `c${colourIndex(p, returnPeriods.length)}`;
        highlights.append(s('circle', { class: `dot ${cls}`, cx: px, cy: y(v), r: 5.5 }));
        const w = halfWidth(d, p);
        rows.unshift(h('div', { class: `tip-row ${cls}` },
          h('span', { class: 'tip-swatch' }),
          h('span', {}, returnPeriodLabel(years)),
          h('span', {}, `${formatValue(v, v < 10 ? 2 : 1)}${p === bandP && w !== null ? ` ± ${formatValue(w, 1)}` : ''}`)));
      });
      const years = station.sampleYears[d];
      clear(tip).append(
        h('div', { class: 'tip-title' }, `${durationLabel(durations[d] as number)} · ${unit}`),
        ...rows,
        h('div', { class: 'tip-note' }, years ? `${years} years of data` : 'Not analysed for this station'),
      );
      tip.hidden = false;
      const tipWidth = tip.offsetWidth;
      const left = px > width / 2 ? px - tipWidth - 14 : px + 14;
      tip.style.left = `${Math.max(0, Math.min(left, width - tipWidth))}px`;
      tip.style.top = `${MARGIN.top + 8}px`;
    };
    const hide = (): void => {
      activeIndex = null;
      cursor.setAttribute('visibility', 'hidden');
      clear(highlights);
      tip.hidden = true;
    };

    overlay.addEventListener('pointermove', (event) => show(nearest(event.clientX)));
    overlay.addEventListener('pointerdown', (event) => show(nearest(event.clientX)));
    overlay.addEventListener('pointerleave', hide);
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', (event) => {
      const last = durations.length - 1;
      const keys: Record<string, () => number> = {
        ArrowRight: () => Math.min(last, (activeIndex ?? -1) + 1),
        ArrowLeft: () => Math.max(0, (activeIndex ?? 1) - 1),
        Home: () => 0,
        End: () => last,
      };
      const move = keys[event.key];
      if (event.key === 'Escape') {
        hide();
      } else if (move) {
        event.preventDefault();
        show(move());
      }
    });
    if (activeIndex !== null) show(activeIndex);
    return svg;
  }

  function draw(newWidth: number): void {
    width = newWidth;
    clear(area);
    area.prepend(buildSvg());
  }

  const dispose = observeWidth(area, draw);
  return {
    update(next) {
      Object.assign(state, next);
      if (width) draw(width);
    },
    destroy: dispose,
  };
}
