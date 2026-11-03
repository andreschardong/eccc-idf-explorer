// Data tables for one station. These double as the accessible text alternative to the charts.
import { h } from './dom';
import { durationLabel, formatValue, returnPeriodLabel } from './format';
import type { Cell, StationDetail } from './types';

function block(title: string, description: string, table: HTMLTableElement): HTMLElement {
  return h('section', { class: 'table-block' },
    h('h3', {}, title),
    description ? h('p', {}, description) : null,
    h('div', { class: 'table-wrap', tabindex: 0, role: 'region', 'aria-label': `${title} (scrolls sideways on narrow screens)` }, table));
}

function periodHeaders(station: StationDetail): HTMLElement[] {
  return station.returnPeriods.map((years) => h('th', { scope: 'col' }, returnPeriodLabel(years)));
}

const valueCell = (v: Cell, digits = 1): HTMLElement => h('td', { class: v === null ? 'muted' : '' }, formatValue(v, digits));

function depthTable(station: StationDetail): HTMLElement {
  const body = station.durations.map((minutes, d) => h('tr', {},
    h('th', { scope: 'row' }, durationLabel(minutes)),
    ...station.returnPeriods.map((_, p) => valueCell(station.depths[d]?.[p] ?? null)),
    h('td', {}, station.sampleYears[d] || '–')));
  return block(
    'Rainfall depth (mm)',
    'Depth that falls in the storm duration, once on average in each return period.',
    h('table', { class: 'data' },
      h('caption', { class: 'visually-hidden' }, 'Rainfall depth in millimetres by duration and return period'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Duration'), ...periodHeaders(station), h('th', { scope: 'col' }, 'Years'))),
      h('tbody', {}, body)));
}

function intensityTable(station: StationDetail): HTMLElement {
  const body = station.durations.flatMap((minutes, d) => [
    h('tr', {},
      h('th', { scope: 'row' }, durationLabel(minutes)),
      ...station.returnPeriods.map((_, p) => valueCell(station.rates[d]?.[p] ?? null))),
    h('tr', {},
      h('th', { scope: 'row', class: 'visually-hidden' }, `${durationLabel(minutes)}, 95% confidence limit`),
      ...station.returnPeriods.map((_, p) => {
        const v = station.confidence[d]?.[p] ?? null;
        return h('td', { class: 'ci' }, v === null ? '' : `± ${formatValue(v)}`);
      })),
  ]);
  return block(
    'Rainfall intensity (mm/h)',
    'Depth divided by duration. The ± line is the half-width of the 95 % confidence interval.',
    h('table', { class: 'data' },
      h('caption', { class: 'visually-hidden' }, 'Rainfall intensity in millimetres per hour by duration and return period, with 95 percent confidence limits'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Duration'), ...periodHeaders(station))),
      h('tbody', {}, body)));
}

function fitTable(station: StationDetail): HTMLElement {
  const rows: [string, Cell[], number][] = [
    ['Coefficient A', station.fit.coefficient, 1],
    ['Exponent B', station.fit.exponent, 3],
    ['Standard error', station.fit.standardError, 1],
    ['Mean error (%)', station.fit.meanPercentError, 1],
  ];
  return block(
    'Interpolation fit: R = A × T^B',
    'R is intensity in mm/h and T is duration in hours, fitted to the 5 min – 24 h values.',
    h('table', { class: 'data' },
      h('caption', { class: 'visually-hidden' }, 'Power-law interpolation coefficients by return period'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Statistic'), ...periodHeaders(station))),
      h('tbody', {}, rows.map(([label, values, digits]) => h('tr', {},
        h('th', { scope: 'row' }, label),
        ...values.map((v) => valueCell(v, digits)))))));
}

export function buildTablesPanel(station: StationDetail): HTMLElement {
  return h('div', {}, depthTable(station), intensityTable(station), fitTable(station));
}

/** Table 1 of the ECCC file: every year's annual maximum depth, in mm. */
export function buildAnnualTable(station: StationDetail): HTMLElement {
  const body = station.annualMaxYears.map((year, i) => h('tr', {},
    h('th', { scope: 'row' }, year),
    ...station.durations.map((_, d) => valueCell(station.annualMaxDepths[i]?.[d] ?? null))));
  const table = h('table', { class: 'data' },
    h('caption', { class: 'visually-hidden' }, 'Annual maximum rainfall depth in millimetres by year and duration'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Year'), ...station.durations.map((m) => h('th', { scope: 'col' }, durationLabel(m))))),
    h('tbody', {}, body));
  return h('div', { class: 'table-wrap scroll-y', tabindex: 0, role: 'region', 'aria-label': 'Annual maximum depths by year (scrolls)' }, table);
}
