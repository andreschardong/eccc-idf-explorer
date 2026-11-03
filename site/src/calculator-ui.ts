// The "Calculator" tab: evaluate R = A * T^B for any duration at the station.
import {
  MAX_DURATION_HOURS, MIN_DURATION_HOURS, evaluateFit, toHours,
} from './calculator';
import { h } from './dom';
import { durationLabel, formatValue, returnPeriodLabel } from './format';
import type { StationDetail } from './types';

export function buildCalculator(station: StationDetail): HTMLElement {
  const defaultPeriod = station.returnPeriods.includes(100) ? 100 : (station.returnPeriods[0] as number);
  const amount = h('input', { id: 'calc-amount', type: 'number', min: '0', step: 'any', value: '90', inputmode: 'decimal' });
  const unit = h('select', { id: 'calc-unit', 'aria-label': 'Duration unit' },
    h('option', { value: 'min', selected: true }, 'minutes'),
    h('option', { value: 'h' }, 'hours'));
  const period = h('select', { id: 'calc-period' },
    station.returnPeriods.map((years) => h('option', { value: years, selected: years === defaultPeriod }, returnPeriodLabel(years))));

  const intensity = h('dd');
  const depth = h('dd');
  const formula = h('p', { class: 'calc-formula' });
  const warning = h('p', { class: 'calc-warn', hidden: true });
  const published = h('p', { class: 'calc-formula' });

  function update(): void {
    const hours = toHours(Number.parseFloat(amount.value), unit.value);
    const years = Number.parseInt(period.value, 10);
    const fit = Number.isFinite(hours) ? evaluateFit(station, years, hours) : null;
    if (!fit) {
      intensity.replaceChildren('–');
      depth.replaceChildren('–');
      formula.textContent = Number.isFinite(hours)
        ? 'ECCC published no fit for this return period at this station.'
        : 'Enter a duration greater than zero.';
      warning.hidden = true;
      published.textContent = '';
      return;
    }
    intensity.replaceChildren(formatValue(fit.intensity, 1), h('small', {}, ' mm/h'));
    depth.replaceChildren(formatValue(fit.depth, 1), h('small', {}, ' mm'));
    formula.textContent = `R = ${formatValue(fit.coefficient, 1)} × T^${formatValue(fit.exponent, 3)}, with T = ${formatValue(hours, 3)} h`;
    warning.hidden = !fit.outsideRange;
    warning.textContent = fit.outsideRange
      ? `ECCC fitted this curve between ${durationLabel(5)} and ${durationLabel(1440)}. Outside that range the result is an extrapolation and should not be used for design.`
      : '';
    const minutes = Math.round(hours * 60);
    const d = station.durations.indexOf(minutes);
    const p = station.returnPeriods.indexOf(years);
    const tableValue = d >= 0 && p >= 0 ? (station.rates[d]?.[p] ?? null) : null;
    published.textContent = tableValue === null
      ? ''
      : `ECCC's published ${durationLabel(minutes)} value for the ${years}-year storm is ${formatValue(tableValue)} mm/h. Use the published value where one exists; the fit smooths between them.`;
  }

  for (const control of [amount, unit, period]) control.addEventListener('input', update);
  update();

  return h('div', {},
    h('div', { class: 'chart-head' }, h('div', {},
      h('h3', { class: 'chart-title' }, 'Interpolate between published durations'),
      h('p', { class: 'chart-sub' }, `Valid from ${formatValue(MIN_DURATION_HOURS * 60, 0)} minutes to ${MAX_DURATION_HOURS} hours.`))),
    h('div', { class: 'calc-grid' },
      h('label', { for: 'calc-amount' }, 'Storm duration', h('span', { class: 'pair' }, amount, unit)),
      h('label', { for: 'calc-period' }, 'Return period', period)),
    h('dl', { class: 'calc-result' },
      h('div', {}, h('dt', {}, 'Rainfall intensity'), intensity),
      h('div', {}, h('dt', {}, 'Rainfall depth'), depth)),
    formula, published, warning);
}
