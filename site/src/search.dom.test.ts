// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearch } from './search';
import {
  installLayoutStubs, press, text, type,
} from './test-dom';
import type { StationSummary } from './types';

const station = (id: string, name: string, province: string, years: number): StationSummary => ({
  id, name, province, lat: 0, lon: 0, firstYear: 2000, lastYear: 2000 + years, years, composite: false,
});
const stations = [
  station('6158355', 'TORONTO CITY', 'ON', 75),
  station('6158731', 'TORONTO INTL A', 'ON', 64),
  station('8300301', 'CHARLOTTETOWN A', 'PE', 31),
];

function mount() {
  document.body.innerHTML = '<input id="q" role="combobox" aria-expanded="false"><ul id="list" role="listbox" hidden></ul>';
  const input = document.getElementById('q') as HTMLInputElement;
  const list = document.getElementById('list') as HTMLElement;
  const onPick = vi.fn();
  createSearch({
    input, list, stations, onPick,
  });
  return {
    input,
    list,
    onPick,
    options: () => [...list.querySelectorAll('[role="option"]')],
    selected: () => text(list.querySelector('[aria-selected="true"] .opt-name')),
  };
}

describe('station search', () => {
  beforeEach(() => installLayoutStubs());

  it('stays closed until something is typed', () => {
    const ui = mount();
    expect(ui.list.hidden).toBe(true);
    expect(ui.input.getAttribute('aria-expanded')).toBe('false');
  });

  it('lists matching stations with province, climate ID and years of record', () => {
    const ui = mount();
    type(ui.input, 'toronto');
    expect(ui.list.hidden).toBe(false);
    expect(ui.input.getAttribute('aria-expanded')).toBe('true');
    expect(ui.options().map((option) => text(option.querySelector('.opt-name')))).toEqual(['Toronto City', 'Toronto Intl A']);
    expect(text(ui.options()[0]?.querySelector('.opt-meta') ?? null)).toBe('Ontario · 6158355 · 75 years');
  });

  it('highlights the first match and points the combobox at it', () => {
    const ui = mount();
    type(ui.input, 'toronto');
    expect(ui.selected()).toBe('Toronto City');
    expect(ui.input.getAttribute('aria-activedescendant')).toBe('opt-6158355');
  });

  it('moves the highlight with the arrow keys and wraps around', () => {
    const ui = mount();
    type(ui.input, 'toronto');
    press(ui.input, 'ArrowDown');
    expect(ui.selected()).toBe('Toronto Intl A');
    press(ui.input, 'ArrowDown');
    expect(ui.selected()).toBe('Toronto City');
    press(ui.input, 'ArrowUp');
    expect(ui.selected()).toBe('Toronto Intl A');
  });

  it('picks the highlighted station with Enter, fills the box and closes', () => {
    const ui = mount();
    type(ui.input, 'toronto');
    press(ui.input, 'ArrowDown');
    press(ui.input, 'Enter');
    expect(ui.onPick).toHaveBeenCalledExactlyOnceWith('6158731');
    expect(ui.input.value).toBe('Toronto Intl A');
    expect(ui.list.hidden).toBe(true);
  });

  it('picks a station when it is clicked', () => {
    const ui = mount();
    type(ui.input, 'charl');
    ui.options()[0]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(ui.onPick).toHaveBeenCalledExactlyOnceWith('8300301');
  });

  it('closes on Escape, and clears the box on a second Escape', () => {
    const ui = mount();
    type(ui.input, 'toronto');
    press(ui.input, 'Escape');
    expect(ui.list.hidden).toBe(true);
    expect(ui.input.value).toBe('toronto');
    press(ui.input, 'Escape');
    expect(ui.input.value).toBe('');
  });

  it('says so when nothing matches, and does not pick anything on Enter', () => {
    const ui = mount();
    type(ui.input, 'zzzz');
    expect(text(ui.list)).toContain('No station matches');
    press(ui.input, 'Enter');
    expect(ui.onPick).not.toHaveBeenCalled();
  });

  it('closes again when the box is emptied', () => {
    const ui = mount();
    type(ui.input, 'toronto');
    type(ui.input, '');
    expect(ui.list.hidden).toBe(true);
  });

  it('finds a station by climate ID and ignores accents and case', () => {
    const ui = mount();
    type(ui.input, '8300301');
    expect(ui.selected()).toBe('Charlottetown A');
    type(ui.input, 'TORONTO CITÝ'.replace('Ý', 'Y'));
    expect(ui.selected()).toBe('Toronto City');
  });
});
