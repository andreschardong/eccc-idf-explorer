// Annual maximum rainfall depth by year for one duration, against the 2-, 10- and 100-year depths.
import { append, clear, h, observeWidth, s } from './dom';
import { durationLabel, formatValue, prettyName } from './format';
import type { ChartController } from './idf-chart';
import { linearScale, linearTicks } from './scales';
import type { StationDetail } from './types';

export interface AnnualOptions {
  /** Index into station.durations. */
  durationIndex: number;
}

export interface AnnualSummaryInfo {
  /** Years with a value for the chosen duration. */
  years: number;
  /** Of those, years above the 100-year depth. */
  over: number;
  /** Years from the first to the last record, inclusive. */
  span: number;
}

export interface AnnualChartController extends ChartController<AnnualOptions> {
  summary(): AnnualSummaryInfo;
}

interface Point {
  year: number;
  value: number;
}

const MARGIN = {
  top: 14, right: 70, bottom: 40, left: 46,
};
const REFERENCE_PERIODS = [2, 10, 100];

export function renderAnnualChart(
  container: HTMLElement,
  station: StationDetail,
  initial: Partial<AnnualOptions> = {},
): AnnualChartController {
  const hourIndex = station.durations.indexOf(60);
  const state: AnnualOptions = { durationIndex: hourIndex >= 0 ? hourIndex : 0, ...initial };
  let width = 0;

  const area = h('div', { class: 'chart' });
  clear(container).append(area);

  const seriesFor = (d: number): Point[] => station.annualMaxYears
    .map((year, i) => ({ year, value: station.annualMaxDepths[i]?.[d] ?? null }))
    .filter((point): point is Point => point.value !== null);

  const referenceDepths = (d: number): { years: number; value: number }[] => REFERENCE_PERIODS
    .map((years) => ({ years, value: station.depths[d]?.[station.returnPeriods.indexOf(years)] ?? null }))
    .filter((ref): ref is { years: number; value: number } => ref.value !== null);

  function draw(newWidth: number): void {
    width = newWidth;
    clear(area);
    const d = state.durationIndex;
    const points = seriesFor(d);
    const refs = referenceDepths(d);
    const hundred = refs.find((r) => r.years === 100)?.value ?? Number.POSITIVE_INFINITY;
    const height = Math.round(Math.min(380, Math.max(260, width * 0.62)));
    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;
    const durationText = durationLabel(station.durations[d] as number);

    if (points.length === 0) {
      area.append(h('p', { class: 'chart-note' }, `No annual maxima were recorded for ${durationText} at this station.`));
      return;
    }

    const dataMax = Math.max(...points.map((p) => p.value));
    const refMax = Math.max(0, ...refs.map((r) => r.value));
    const { ticks, top } = linearTicks(Math.max(dataMax, Math.min(refMax, dataMax * 1.6)) * 1.04);
    const y = linearScale(0, top, MARGIN.top + plotH, MARGIN.top);
    const firstYear = station.annualMaxYears[0] as number;
    const lastYear = station.annualMaxYears[station.annualMaxYears.length - 1] as number;
    const x = linearScale(firstYear - 0.5, lastYear + 0.5, MARGIN.left, MARGIN.left + plotW);
    const slot = plotW / (lastYear - firstYear + 1);
    const barWidth = Math.max(2, slot - 2);

    const svg = s('svg', {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'img',
      tabindex: 0,
      'aria-label': `Annual maximum ${durationText} rainfall depth at ${prettyName(station.name)}, ${points.length} years from ${points[0]?.year} to ${points[points.length - 1]?.year}. `
        + `The largest was ${formatValue(dataMax)} mm. Use the left and right arrow keys to read each year. The table below the chart has the same numbers.`,
    });

    for (const tick of ticks) {
      svg.append(
        s('line', { class: 'grid', x1: MARGIN.left, x2: MARGIN.left + plotW, y1: y(tick), y2: y(tick) }),
        s('text', { x: MARGIN.left - 8, y: y(tick), dy: '0.32em', 'text-anchor': 'end' }, tick.toLocaleString('en-CA')),
      );
    }
    const step = Math.max(1, Math.ceil((lastYear - firstYear) / Math.max(2, Math.floor(plotW / 56)) / 5) * 5);
    for (let year = Math.ceil(firstYear / step) * step; year <= lastYear; year += step) {
      svg.append(s('text', { x: x(year), y: MARGIN.top + plotH + 16, 'text-anchor': 'middle' }, year));
    }
    svg.append(
      s('line', { class: 'axis', x1: MARGIN.left, x2: MARGIN.left + plotW, y1: y(0), y2: y(0) }),
      s('text', { class: 'axis-title', x: MARGIN.left + plotW / 2, y: height - 6, 'text-anchor': 'middle' }, 'Year'),
      s('text', { class: 'axis-title', transform: `translate(12 ${MARGIN.top + plotH / 2}) rotate(-90)`, 'text-anchor': 'middle' }, 'Annual maximum depth (mm)'),
    );

    const bars = new Map<number, SVGRectElement>();
    for (const point of points) {
      const bar = s('rect', {
        class: `bar${point.value > hundred ? ' over' : ''}`,
        x: x(point.year) - barWidth / 2,
        y: y(point.value),
        width: barWidth,
        height: Math.max(0, y(0) - y(point.value)),
        rx: Math.min(4, barWidth / 2),
      });
      bars.set(point.year, bar);
      svg.append(bar);
    }

    for (const ref of refs) {
      if (ref.value > top) continue;
      svg.append(
        s('line', { class: 'ref', x1: MARGIN.left, x2: MARGIN.left + plotW, y1: y(ref.value), y2: y(ref.value) }),
        s('text', { class: 'ref-label', x: MARGIN.left + plotW + 6, y: y(ref.value), dy: '0.32em' }, `${ref.years}-yr`),
      );
    }

    const tip = h('div', { class: 'chart-tip', hidden: true });
    area.append(tip);
    const overlay = s('rect', { x: MARGIN.left, y: MARGIN.top, width: plotW, height: plotH, fill: 'transparent' });
    svg.append(overlay);

    let active: number | null = null;
    const show = (index: number): void => {
      const point = points[index] as Point;
      active = index;
      bars.forEach((bar) => bar.classList.remove('active'));
      bars.get(point.year)?.classList.add('active');
      const over = point.value > hundred;
      append(clear(tip), [
        h('div', { class: 'tip-title' }, String(point.year)),
        h('div', { class: `tip-row${over ? ' over' : ''}` }, h('span', { class: 'tip-swatch' }), h('span', {}, durationText), h('span', {}, `${formatValue(point.value)} mm`)),
        refs.map((ref) => h('div', { class: 'tip-note' }, `${ref.years}-year: ${formatValue(ref.value)} mm`)),
        over ? h('div', { class: 'tip-note' }, 'Above the 100-year amount') : null,
      ]);
      tip.hidden = false;
      const px = x(point.year);
      const tipWidth = tip.offsetWidth;
      const left = px > width / 2 ? px - tipWidth - 12 : px + 12;
      tip.style.left = `${Math.max(0, Math.min(left, width - tipWidth))}px`;
      tip.style.top = `${MARGIN.top + 6}px`;
    };
    const hide = (): void => {
      active = null;
      bars.forEach((bar) => bar.classList.remove('active'));
      tip.hidden = true;
    };
    const nearest = (clientX: number): number => {
      const box = svg.getBoundingClientRect();
      const year = firstYear - 0.5 + ((((clientX - box.left) / box.width) * width) - MARGIN.left) / slot;
      let best = 0;
      points.forEach((point, i) => {
        if (Math.abs(point.year - year) < Math.abs((points[best] as Point).year - year)) best = i;
      });
      return best;
    };
    overlay.addEventListener('pointermove', (event) => show(nearest(event.clientX)));
    overlay.addEventListener('pointerdown', (event) => show(nearest(event.clientX)));
    overlay.addEventListener('pointerleave', hide);
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', (event) => {
      const last = points.length - 1;
      const keys: Record<string, () => number> = {
        ArrowRight: () => Math.min(last, (active ?? -1) + 1),
        ArrowLeft: () => Math.max(0, (active ?? 1) - 1),
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

    area.prepend(svg);
  }

  const dispose = observeWidth(area, draw);
  return {
    update(next) {
      Object.assign(state, next);
      if (width) draw(width);
    },
    summary() {
      const d = state.durationIndex;
      const points = seriesFor(d);
      const hundred = referenceDepths(d).find((r) => r.years === 100)?.value;
      const years = station.annualMaxYears;
      return {
        years: points.length,
        over: hundred === undefined ? 0 : points.filter((p) => p.value > hundred).length,
        span: years.length ? (years[years.length - 1] as number) - (years[0] as number) + 1 : 0,
      };
    },
    destroy: dispose,
  };
}
