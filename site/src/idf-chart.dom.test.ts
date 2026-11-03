// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { colourIndex, renderIdfChart } from './idf-chart';
import {
  charlottetown, cowichan, installLayoutStubs, press, text,
} from './test-dom';
import type { StationDetail } from './types';

function mount(station: StationDetail) {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  const chart = renderIdfChart(container, station);
  const svg = (): SVGSVGElement => container.querySelector('svg') as SVGSVGElement;
  return {
    chart,
    container,
    svg,
    tip: () => container.querySelector<HTMLElement>('.chart-tip') as HTMLElement,
    all: (selector: string) => [...container.querySelectorAll(selector)],
  };
}

describe('IDF chart', () => {
  beforeEach(() => installLayoutStubs());

  it('draws one curve and one end label per return period', () => {
    const ui = mount(charlottetown);
    expect(ui.all('path.line')).toHaveLength(7);
    expect(ui.all('text.end-label').map(text)).toEqual(['2-yr', '5-yr', '10-yr', '25-yr', '50-yr', '100-yr', '200-yr']);
  });

  it('puts a legend with every return period above the plot', () => {
    const ui = mount(charlottetown);
    expect(ui.all('.legend-inline li').map(text)).toEqual(['2-year', '5-year', '10-year', '25-year', '50-year', '100-year', '200-year']);
  });

  it('marks a point for every analysed duration and return period', () => {
    expect(mount(charlottetown).all('circle.dot')).toHaveLength(9 * 7);
    expect(mount(cowichan).all('circle.dot')).toHaveLength(5 * 7);
  });

  it('describes itself for screen readers, with the table pointer', () => {
    const label = mount(charlottetown).svg().getAttribute('aria-label') ?? '';
    expect(label).toContain('IDF curves for Charlottetown A');
    expect(label).toContain('left and right arrow keys');
    expect(label).toContain('Tables tab');
    expect(mount(charlottetown).svg().getAttribute('role')).toBe('img');
    expect(mount(charlottetown).svg().getAttribute('tabindex')).toBe('0');
  });

  it('shades the durations ECCC did not analyse and says so on the plot', () => {
    expect(mount(cowichan).all('text.gap-label').map(text)).toEqual(['Not analysed']);
    expect(mount(charlottetown).all('text.gap-label')).toHaveLength(0);
  });

  it('shows a tooltip for the first duration on the right arrow key, then the next', () => {
    const ui = mount(charlottetown);
    expect(ui.tip().hidden).toBe(true);
    press(ui.svg(), 'ArrowRight');
    expect(ui.tip().hidden).toBe(false);
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('5 min · mm/h');
    press(ui.svg(), 'ArrowRight');
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('10 min · mm/h');
  });

  it('lists the longest return period first in the tooltip, with its value', () => {
    const ui = mount(charlottetown);
    press(ui.svg(), 'End');
    const rows = [...ui.tip().querySelectorAll('.tip-row')].map((row) => [...row.children].map(text));
    expect(rows[0]).toEqual(['', '200-year', '5.80']);
    expect(rows.at(-1)).toEqual(['', '2-year', '2.50']);
    expect(text(ui.tip().querySelector('.tip-note'))).toBe('32 years of data');
  });

  it('jumps with Home and End, and closes with Escape', () => {
    const ui = mount(charlottetown);
    press(ui.svg(), 'End');
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('24 h · mm/h');
    press(ui.svg(), 'Home');
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('5 min · mm/h');
    press(ui.svg(), 'Escape');
    expect(ui.tip().hidden).toBe(true);
  });

  it('says a duration was not analysed when the tooltip lands on one', () => {
    const ui = mount(cowichan);
    press(ui.svg(), 'ArrowRight');
    expect(text(ui.tip().querySelector('.tip-note'))).toBe('Not analysed for this station');
  });

  it('switches to depth, relabelling the axis and the tooltip', () => {
    const ui = mount(charlottetown);
    ui.chart.update({ mode: 'depth' });
    expect(ui.all('text.axis-title').map(text)).toContain('Rainfall depth (mm)');
    press(ui.svg(), 'Home');
    expect(text(ui.tip().querySelector('.tip-title'))).toBe('5 min · mm');
  });

  it('draws a confidence band only for the chosen return period', () => {
    const ui = mount(charlottetown);
    expect(ui.all('path.band')).toHaveLength(0);
    ui.chart.update({ ciPeriod: 100 });
    expect(ui.all('path.band')).toHaveLength(1);
    expect(ui.all('path.band')[0]?.getAttribute('class')).toContain('c5');
    ui.chart.update({ ciPeriod: null });
    expect(ui.all('path.band')).toHaveLength(0);
  });

  it('keeps the tooltip open when the band changes', () => {
    const ui = mount(charlottetown);
    press(ui.svg(), 'ArrowRight');
    ui.chart.update({ ciPeriod: 100 });
    expect(ui.tip().hidden).toBe(false);
    const rows = [...ui.tip().querySelectorAll('.tip-row')].map(text);
    expect(rows.find((row) => row.startsWith('100-year'))).toContain('±');
    expect(rows.find((row) => row.startsWith('50-year'))).not.toContain('±');
  });
});

describe('colourIndex', () => {
  it('uses each of the seven ramp steps once for seven return periods', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((p) => colourIndex(p, 7))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('spreads fewer periods across the ramp, ending on the darkest step', () => {
    expect(colourIndex(0, 3)).toBe(0);
    expect(colourIndex(2, 3)).toBe(6);
    expect(colourIndex(0, 1)).toBe(6);
  });
});
