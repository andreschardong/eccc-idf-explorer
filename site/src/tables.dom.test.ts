// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildAnnualTable, buildTablesPanel } from './tables';
import { charlottetown, cowichan, text } from './test-dom';

const cells = (row: Element | undefined): string[] => [...(row?.querySelectorAll('th, td') ?? [])].map(text);

describe('buildTablesPanel', () => {
  const panel = buildTablesPanel(charlottetown);
  const [depth, intensity, fit] = [...panel.querySelectorAll('table')];

  it('has depth, intensity and fit tables, each with a screen-reader caption', () => {
    expect([...panel.querySelectorAll('caption')].map(text)).toEqual([
      'Rainfall depth in millimetres by duration and return period',
      'Rainfall intensity in millimetres per hour by duration and return period, with 95 percent confidence limits',
      'Power-law interpolation coefficients by return period',
    ]);
  });

  it('heads the depth table with one column per return period and the years of data', () => {
    expect(cells(depth?.querySelector('thead tr') ?? undefined)).toEqual([
      'Duration', '2-year', '5-year', '10-year', '25-year', '50-year', '100-year', '200-year', 'Years',
    ]);
  });

  it('shows ECCC depths by duration and return period', () => {
    const rows = [...(depth?.querySelectorAll('tbody tr') ?? [])];
    expect(rows).toHaveLength(9);
    expect(cells(rows[0])).toEqual(['5 min', '5.1', '7.4', '8.9', '10.8', '12.3', '13.7', '15.1', '31']);
    expect(cells(rows[8])?.[7]).toBe('139.3');
  });

  it('adds a confidence-limit row under every intensity row', () => {
    const rows = [...(intensity?.querySelectorAll('tbody tr') ?? [])];
    expect(rows).toHaveLength(18);
    expect(cells(rows[0]).slice(0, 3)).toEqual(['5 min', '60.8', '88.5']);
    expect(cells(rows[1]).slice(1, 3)).toEqual(['± 10.2', '± 17.1']);
  });

  it('lists the interpolation fit', () => {
    const coefficient = [...(fit?.querySelectorAll('tbody tr') ?? [])].find((row) => text(row.querySelector('th')) === 'Coefficient A');
    expect(cells(coefficient)[1]).toBe('17.4');
  });

  it('shows an en dash, in a muted cell, where ECCC did not analyse a duration', () => {
    const [cowichanDepth] = [...buildTablesPanel(cowichan).querySelectorAll('table')];
    const firstRow = cowichanDepth?.querySelector('tbody tr');
    expect(cells(firstRow ?? undefined).slice(1, 8)).toEqual(Array(7).fill('–'));
    expect(firstRow?.querySelector('td')?.className).toBe('muted');
  });

  it('prints the sample years, with a dash when a duration has none', () => {
    const [cowichanDepth] = [...buildTablesPanel(cowichan).querySelectorAll('table')];
    expect(cells(cowichanDepth?.querySelector('tbody tr') ?? undefined).at(-1)).toBe('–');
  });
});

describe('buildAnnualTable', () => {
  const table = buildAnnualTable(charlottetown);
  const rows = [...table.querySelectorAll('tbody tr')];

  it('has one row per year with data', () => {
    expect(rows).toHaveLength(charlottetown.annualMaxYears.length);
    expect(cells(rows[0]).slice(0, 3)).toEqual(['1967', '7.1', '10.9']);
  });

  it('marks values that were not observed', () => {
    const year2007 = rows.find((row) => text(row.querySelector('th')) === '2007');
    expect(cells(year2007).slice(1, 4)).toEqual(['–', '–', '–']);
  });

  it('scrolls on its own so a long record does not push the page down', () => {
    expect(table.className).toContain('scroll-y');
  });
});
