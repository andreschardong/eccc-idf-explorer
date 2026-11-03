// Accessible combobox (ARIA 1.2 list autocomplete) for finding a station by name, climate ID or province.
import { clear, h } from './dom';
import { foldText, prettyName, provinceName } from './format';
import type { StationSummary } from './types';

const MAX_RESULTS = 8;

export interface IndexedStation extends StationSummary {
  /** Lower-case, accent-free name used for matching. */
  folded: string;
}

export function indexStations(stations: readonly StationSummary[]): IndexedStation[] {
  return stations.map((station) => ({ ...station, folded: foldText(station.name) }));
}

/** Ranks stations for `query`: name prefix, climate ID, word prefix, substring, then province. */
export function rankStations(stations: readonly IndexedStation[], query: string): IndexedStation[] {
  const q = foldText(query.trim());
  if (!q) return [];
  const scored: { station: IndexedStation; score: number }[] = [];
  for (const station of stations) {
    const name = station.folded;
    let score = 0;
    if (name.startsWith(q)) score = 100;
    else if (station.id.toLowerCase().startsWith(q)) score = 90;
    else if (name.split(/[\s\-/(]+/).some((word) => word.startsWith(q))) score = 80;
    else if (name.includes(q)) score = 60;
    else if (station.province.toLowerCase() === q || foldText(provinceName(station.province)) === q) score = 30;
    if (score) scored.push({ station, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.station.years - a.station.years || a.station.name.localeCompare(b.station.name))
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.station);
}

export interface SearchOptions {
  input: HTMLInputElement;
  list: HTMLElement;
  stations: readonly StationSummary[];
  onPick: (id: string) => void;
}

export function createSearch({
  input, list, stations, onPick,
}: SearchOptions): void {
  const indexed = indexStations(stations);
  let results: IndexedStation[] = [];
  let active = -1;

  const open = (isOpen: boolean): void => {
    list.hidden = !isOpen;
    input.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) input.removeAttribute('aria-activedescendant');
  };

  function markActive(): void {
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === active));
      if (i === active) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function pick(station: IndexedStation): void {
    input.value = prettyName(station.name);
    open(false);
    input.blur();
    onPick(station.id);
  }

  function render(): void {
    clear(list);
    if (!input.value.trim()) {
      open(false);
      return;
    }
    results = rankStations(indexed, input.value);
    active = results.length ? 0 : -1;
    if (!results.length) {
      list.append(h('li', { class: 'opt-empty', role: 'presentation' }, 'No station matches. Try part of the name, or a climate ID.'));
    }
    results.forEach((station, i) => list.append(h('li', {
      id: `opt-${station.id}`,
      role: 'option',
      'aria-selected': String(i === active),
      onmousedown: (event: MouseEvent) => {
        event.preventDefault();
        pick(station);
      },
    },
    h('span', { class: 'opt-name' }, prettyName(station.name)),
    h('span', { class: 'opt-meta' }, `${provinceName(station.province)} · ${station.id} · ${station.years} years`))));
    open(true);
    markActive();
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', () => {
    if (input.value.trim()) render();
  });
  input.addEventListener('blur', () => setTimeout(() => open(false), 100));
  input.addEventListener('keydown', (event) => {
    const chosen = results[active];
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      if (list.hidden) open(true);
      active = (active + 1) % results.length;
      markActive();
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      active = (active - 1 + results.length) % results.length;
      markActive();
    } else if (event.key === 'Enter' && !list.hidden && chosen) {
      event.preventDefault();
      pick(chosen);
    } else if (event.key === 'Escape') {
      if (!list.hidden) open(false);
      else input.value = '';
    }
  });
}
