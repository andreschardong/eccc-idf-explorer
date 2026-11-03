// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderAnnualChart } from './annual-chart';
import {
  charlottetown, installLayoutStubs, press, text,
} from './test-dom';

const HOUR = charlottetown.durations.indexOf(60);
const MINUTES_5 = charlottetown.durations.indexOf(5);

function mount() {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  const chart = renderAnnualChart(container, charlottetown);
  return {
    chart,
    container,
    svg: () => container.querySelector('svg') as SVGSVGElement,
    tip: () => container.querySelector<HTMLElement>('.chart-tip') as HTMLElement,
    bars: () => [...container.querySelectorAll('rect.bar')],
  };
}

const yearsWithValue = (d: number): number => charlottetown.annualMaxDepths.filter((row) => row[d] !== null).length;

describe('annual maxima chart', () => {
  beforeEach(() => installLayoutStubs());

  it('starts on the one-hour duration with a bar for every year that has a value', () => {
    expect(mount().bars()).toHaveLength(yearsWithValue(HOUR));
  });

  it('leaves the years without a value as gaps rather than zero-height bars', () => {
    const ui = mount();
    expect(yearsWithValue(HOUR)).toBeLessThan(charlottetown.annualMaxYears.length);
    expect(ui.bars().every((bar) => Number(bar.getAttribute('height')) > 0)).toBe(true);
  });

  it('draws dashed lines for the 2-, 10- and 100-year depths', () => {
    const ui = mount();
    expect([...ui.container.querySelectorAll('text.ref-label')].map(text)).toEqual(['2-yr', '10-yr', '100-yr']);
    expect(ui.container.querySelectorAll('line.ref')).toHaveLength(3);
  });

  it('colours the bars that beat the 100-year depth differently', () => {
    const ui = mount();
    const hundred = charlottetown.depths[HOUR]?.[charlottetown.returnPeriods.indexOf(100)] ?? Infinity;
    const expected = charlottetown.annualMaxDepths.filter((row) => (row[HOUR] ?? 0) > hundred).length;
    expect(ui.container.querySelectorAll('rect.bar.over')).toHaveLength(expected);
    const fiveMinute = ui.chart;
    fiveMinute.update({ durationIndex: charlottetown.durations.indexOf(1440) });
    const hundred24 = charlottetown.depths[charlottetown.durations.indexOf(1440)]?.[5] ?? Infinity;
    expect(ui.container.querySelectorAll('rect.bar.over')).toHaveLength(
      charlottetown.annualMaxDepths.filter((row) => (row[charlottetown.durations.indexOf(1440)] ?? 0) > hundred24).length,
    );
  });

  it('redraws for another duration', () => {
    const ui = mount();
    ui.chart.update({ durationIndex: MINUTES_5 });
    expect(ui.bars()).toHaveLength(yearsWithValue(MINUTES_5));
    expect(ui.svg().getAttribute('aria-label')).toContain('Annual maximum 5 min rainfall depth');
  });

  it('reports how many years have a value, how many beat the 100-year depth, and the span', () => {
    const summary = mount().chart.summary();
    expect(summary.years).toBe(yearsWithValue(HOUR));
    expect(summary.span).toBe(50);
    expect(summary.over).toBe(0);
  });

  it('reads each year with the arrow keys, showing the year and its depth', () => {
    const ui = mount();
    press(ui.svg(), 'Home');
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('1967');
    expect([...(ui.tip().querySelector('.tip-row')?.children ?? [])].map(text)).toEqual(['', '1 h', '32.0 mm']);
    press(ui.svg(), 'ArrowRight');
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('1968');
    press(ui.svg(), 'End');
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('2016');
    press(ui.svg(), 'Escape');
    expect(ui.tip().hidden).toBe(true);
  });

  it('highlights the bar being read', () => {
    const ui = mount();
    press(ui.svg(), 'Home');
    expect(ui.container.querySelectorAll('rect.bar.active')).toHaveLength(1);
    press(ui.svg(), 'Escape');
    expect(ui.container.querySelectorAll('rect.bar.active')).toHaveLength(0);
  });

  it('describes itself for screen readers', () => {
    const label = mount().svg().getAttribute('aria-label') ?? '';
    expect(label).toContain('Charlottetown A');
    expect(label).toContain('arrow keys');
  });
});
