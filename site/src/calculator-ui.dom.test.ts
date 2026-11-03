// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateFit } from './calculator';
import { buildCalculator } from './calculator-ui';
import { formatValue } from './format';
import { charlottetown, installLayoutStubs, text } from './test-dom';

function mount() {
  document.body.replaceChildren(buildCalculator(charlottetown));
  const field = (id: string) => document.getElementById(id) as HTMLInputElement & HTMLSelectElement;
  const set = (element: HTMLInputElement | HTMLSelectElement, value: string): void => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return {
    amount: field('calc-amount'),
    unit: field('calc-unit'),
    period: field('calc-period'),
    set,
    results: () => [...document.querySelectorAll('.calc-result dd')].map(text),
    warning: () => document.querySelector<HTMLElement>('.calc-warn'),
    notes: () => [...document.querySelectorAll('.calc-formula')].map(text),
  };
}

describe('calculator', () => {
  beforeEach(() => installLayoutStubs());

  it('starts at 90 minutes and the 100-year storm', () => {
    const ui = mount();
    const expected = evaluateFit(charlottetown, 100, 1.5);
    expect(ui.amount.value).toBe('90');
    expect(ui.period.value).toBe('100');
    expect(ui.results()).toEqual([
      `${formatValue(expected?.intensity)} mm/h`,
      `${formatValue(expected?.depth)} mm`,
    ]);
  });

  it('recalculates when the duration changes', () => {
    const ui = mount();
    ui.set(ui.amount, '2');
    ui.set(ui.unit, 'h');
    const expected = evaluateFit(charlottetown, 100, 2);
    expect(ui.results()[0]).toBe(`${formatValue(expected?.intensity)} mm/h`);
  });

  it('recalculates when the return period changes', () => {
    const ui = mount();
    ui.set(ui.period, '2');
    ui.set(ui.amount, '60');
    const expected = evaluateFit(charlottetown, 2, 1);
    expect(ui.results()[0]).toBe(`${formatValue(expected?.intensity)} mm/h`);
  });

  it('shows the formula it used', () => {
    const ui = mount();
    expect(ui.notes()[0]).toBe('R = 40.1 × T^-0.578, with T = 1.500 h');
  });

  it("quotes ECCC's published value when the duration is one of the published ones", () => {
    const ui = mount();
    ui.set(ui.period, '2');
    ui.set(ui.amount, '60');
    expect(ui.notes().join(' ')).toContain("ECCC's published 1 h value for the 2-year storm is 18.7 mm/h");
  });

  it('says nothing about a published value between published durations', () => {
    const ui = mount();
    expect(ui.notes()[1]).toBe('');
  });

  it('warns that a duration outside 5 minutes to 24 hours is an extrapolation', () => {
    const ui = mount();
    expect(ui.warning()?.hidden).toBe(true);
    ui.set(ui.amount, '2');
    expect(ui.warning()?.hidden).toBe(false);
    expect(text(ui.warning())).toContain('extrapolation');
    ui.set(ui.amount, '30');
    expect(ui.warning()?.hidden).toBe(true);
  });

  it('asks for a duration when the box is empty or not positive', () => {
    const ui = mount();
    ui.set(ui.amount, '');
    expect(ui.results()).toEqual(['–', '–']);
    expect(ui.notes()[0]).toBe('Enter a duration greater than zero.');
    ui.set(ui.amount, '-5');
    expect(ui.notes()[0]).toBe('Enter a duration greater than zero.');
  });

  it('offers every return period the station has', () => {
    const ui = mount();
    expect([...ui.period.options].map((option) => option.value)).toEqual(['2', '5', '10', '25', '50', '100', '200']);
  });
});
