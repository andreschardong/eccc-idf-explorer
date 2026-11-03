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

  it('draws one end label per return period', () => {
    const ui = mount(charlottetown);
    expect(ui.all('text.end-label').map(text)).toEqual(['2-yr', '5-yr', '10-yr', '25-yr', '50-yr', '100-yr', '200-yr']);
  });

  it('never joins the published values with lines: they are separate estimates', () => {
    const ui = mount(charlottetown);
    expect(ui.all('path.line, polyline')).toHaveLength(0);
    expect(ui.all('circle.dot')).toHaveLength(63);
    // The only paths in the plot are ECCC's fitted equations; with them off, there are none at all.
    expect(ui.all('path').every((path) => path.getAttribute('class')?.startsWith('fit'))).toBe(true);
    ui.chart.update({ showFit: false });
    expect(ui.all('path')).toHaveLength(0);
  });

  describe('ECCC\'s fitted equations', () => {
    const endpoints = (path: Element): [number, number, number, number] => {
      const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      return numbers as [number, number, number, number];
    };

    it('draw one straight line per return period, as ECCC\'s own graph does', () => {
      const ui = mount(charlottetown);
      const lines = ui.all('path.fit');
      expect(lines).toHaveLength(7);
      for (const line of lines) expect(line.getAttribute('d')).toMatch(/^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
    });

    it('take the colour of their return period, so each line matches its dots', () => {
      const ui = mount(charlottetown);
      expect(ui.all('path.fit').map((line) => line.getAttribute('class'))).toEqual(
        ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((c) => `fit ${c}`),
      );
    });

    it('fall with duration for intensity, and rarer storms sit higher', () => {
      const ui = mount(charlottetown);
      const lines = ui.all('path.fit').map(endpoints);
      for (const [, y1, , y2] of lines) expect(y2).toBeGreaterThan(y1); // lower on screen at 24 h
      for (let i = 1; i < lines.length; i += 1) {
        expect((lines[i] as number[])[1]).toBeLessThan((lines[i - 1] as number[])[1] as number); // higher on screen
        expect((lines[i] as number[])[3]).toBeLessThan((lines[i - 1] as number[])[3] as number);
      }
    });

    it('rise with duration when the quantity is depth (depth is intensity times duration)', () => {
      const ui = mount(charlottetown);
      ui.chart.update({ mode: 'depth' });
      for (const line of ui.all('path.fit')) {
        const [, y1, , y2] = endpoints(line);
        expect(y2).toBeLessThan(y1 as number);
      }
    });

    it('begin and end at the first and last analysed durations, which are the dots at each end', () => {
      const ui = mount(charlottetown);
      const dots = ui.all('circle.dot.c0').map((dot) => Number(dot.getAttribute('cx')));
      const [x1, , x2] = endpoints(ui.all('path.fit')[0] as Element);
      expect(x1).toBeCloseTo(Math.min(...dots), 0);
      expect(x2).toBeCloseTo(Math.max(...dots), 0);
    });

    it('start where ECCC started its fit when the short durations were not analysed', () => {
      const ui = mount(cowichan);
      const dots = ui.all('circle.dot.c0').map((dot) => Number(dot.getAttribute('cx')));
      expect(dots).toHaveLength(5);
      const [x1] = endpoints(ui.all('path.fit')[0] as Element);
      expect(x1).toBeCloseTo(Math.min(...dots), 0);
    });

    it('can be switched off and on, and the key follows', () => {
      const ui = mount(charlottetown);
      const fitKey = ui.container.querySelectorAll('.legend-inline')[1]?.lastElementChild as HTMLElement;
      expect(fitKey.hidden).toBe(false);
      ui.chart.update({ showFit: false });
      expect(ui.all('path.fit')).toHaveLength(0);
      expect(fitKey.hidden).toBe(true);
      ui.chart.update({ showFit: true });
      expect(ui.all('path.fit')).toHaveLength(7);
      expect(fitKey.hidden).toBe(false);
    });

    it('are mentioned for screen readers', () => {
      expect(mount(charlottetown).svg().getAttribute('aria-label')).toContain("lines are ECCC's fitted equation");
    });
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
