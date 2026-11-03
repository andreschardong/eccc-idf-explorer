// The right-hand card: an empty state with ways in, and the detail view for one station.
import { renderAnnualChart } from './annual-chart';
import { buildCalculator } from './calculator-ui';
import { loadStation, stationJsonUrl } from './data';
import { clear, h } from './dom';
import { csvFileName, downloadText, stationToCsv } from './export';
import {
  durationLabel, formatCoordinates, formatValue, prettyName, provinceName, returnPeriodLabel,
} from './format';
import { renderIdfChart, type ChartController, type IdfOptions } from './idf-chart';
import { buildAnnualTable, buildTablesPanel } from './tables';
import type { DatasetInfo, StationDetail, StationSummary } from './types';

export type TabId = 'curves' | 'tables' | 'annual' | 'calc';

export const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'curves', label: 'Curves' },
  { id: 'tables', label: 'Tables' },
  { id: 'annual', label: 'Annual' },
  { id: 'calc', label: 'Calculator' },
];

export function isTabId(value: string | undefined): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

const SHORT_RECORD_YEARS = 25;

export interface StationPanelOptions {
  emptyRoot: HTMLElement;
  stationRoot: HTMLElement;
  scroller: HTMLElement;
  dataset: DatasetInfo;
  index: readonly StationSummary[];
  onSelect(id: string): void;
  onTabChange(tab: TabId): void;
}

export interface StationPanel {
  showEmpty(): void;
  show(id: string): Promise<void>;
  selectTab(id: TabId): void;
  readonly tab: TabId;
}

export function createStationPanel({
  emptyRoot, stationRoot, scroller, dataset, index, onSelect, onTabChange,
}: StationPanelOptions): StationPanel {
  let disposers: (() => void)[] = [];
  let tab: TabId = 'curves';
  let token = 0;

  const disposeAll = (): void => {
    disposers.forEach((dispose) => dispose());
    disposers = [];
  };

  function showEmpty(): void {
    token += 1;
    disposeAll();
    stationRoot.hidden = true;
    emptyRoot.hidden = false;
    const longest = [...index].sort((a, b) => b.years - a.years || a.name.localeCompare(b.name)).slice(0, 5);
    const wettest = index
      .filter((s): s is StationSummary & { depth100Yr24h: number } => s.depth100Yr24h !== undefined)
      .sort((a, b) => b.depth100Yr24h - a.depth100Yr24h)
      .slice(0, 5);
    const list = (stations: readonly StationSummary[], meta: (s: StationSummary) => string): HTMLElement => h('ul', { class: 'pick-list' },
      stations.map((s) => h('li', {},
        h('button', { type: 'button', onclick: () => onSelect(s.id) },
          h('span', { class: 'pick-name' }, `${prettyName(s.name)}, ${s.province}`),
          h('span', { class: 'pick-meta' }, meta(s))))));
    const years = index.map((s) => s.years);
    clear(emptyRoot).append(h('div', { class: 'pane-section empty' },
      h('h2', {}, 'Rainfall design values for Canadian stations'),
      h('p', {}, 'Pick a station on the map, or search for one by name or climate ID, to see its intensity-duration-frequency curves, tables and annual maxima.'),
      h('p', { class: 'stat-line' }, `${index.length} stations · ${Math.min(...years)} to ${Math.max(...years)} years of record · ECCC release ${dataset.release}`),
      h('h3', { class: 'pick-heading' }, 'Longest records'),
      list(longest, (s) => `${s.years} years`),
      h('h3', { class: 'pick-heading' }, 'Largest 100-year, 24-hour depths'),
      list(wettest, (s) => `${formatValue(s.depth100Yr24h)} mm`)));
  }

  async function show(id: string): Promise<void> {
    token += 1;
    const mine = token;
    disposeAll();
    emptyRoot.hidden = true;
    stationRoot.hidden = false;
    clear(stationRoot).append(h('div', { class: 'pane-section' }, h('p', { class: 'muted-text', role: 'status' }, 'Loading station…')));
    let station: StationDetail;
    try {
      station = await loadStation(id);
    } catch (error) {
      if (mine !== token) return;
      const message = error instanceof Error ? error.message : String(error);
      clear(stationRoot).append(h('div', { class: 'pane-section' },
        h('p', { role: 'alert' }, `Could not load station ${id}. ${message}`),
        h('button', { class: 'btn', type: 'button', onclick: () => void show(id) }, 'Try again')));
      return;
    }
    if (mine !== token) return;
    render(station);
    scroller.scrollTop = 0;
  }

  function render(station: StationDetail): void {
    const depthAt = (minutes: number, years: number): number | null => {
      const d = station.durations.indexOf(minutes);
      const p = station.returnPeriods.indexOf(years);
      return d >= 0 && p >= 0 ? (station.depths[d]?.[p] ?? null) : null;
    };
    const rateAt = (minutes: number, years: number): number | null => {
      const d = station.durations.indexOf(minutes);
      const p = station.returnPeriods.indexOf(years);
      return d >= 0 && p >= 0 ? (station.rates[d]?.[p] ?? null) : null;
    };
    const tile = (minutes: number): HTMLElement => {
      const depth = depthAt(minutes, 100);
      const rate = rateAt(minutes, 100);
      return h('div', { class: 'tile' },
        h('dt', {}, `100-year storm, ${durationLabel(minutes)}`),
        h('dd', {}, depth === null ? '–' : [formatValue(depth), h('small', {}, ' mm')]),
        h('dd', { class: 'tile-sub' }, rate === null ? 'Not analysed' : `${formatValue(rate)} mm/h`));
    };

    const copyButton = h('button', { class: 'btn', type: 'button' }, 'Copy link');
    copyButton.addEventListener('click', () => {
      void navigator.clipboard?.writeText(location.href).then(() => {
        copyButton.textContent = 'Link copied';
        setTimeout(() => { copyButton.textContent = 'Copy link'; }, 2000);
      }).catch(() => {});
    });

    const head = h('div', { class: 'station-head' },
      h('h2', { id: 'station-title', tabindex: -1 }, prettyName(station.name)),
      h('p', { class: 'station-sub' },
        `${provinceName(station.province)} · Climate ID ${station.id}`,
        station.composite ? h('span', { class: 'badge', title: 'ECCC joined the records of nearby climate stations into one series.' }, 'Joined records') : null),
      h('dl', { class: 'tiles' }, tile(60), tile(1440)),
      h('dl', { class: 'station-facts' },
        fact('Record', `${station.firstYear}–${station.lastYear}`),
        fact('Years of data', String(station.years)),
        fact('Location', formatCoordinates(station.lat, station.lon)),
        fact('Elevation', station.elevation === undefined ? '–' : `${formatValue(station.elevation, 0)} m`)),
      h('div', { class: 'station-actions' },
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          onclick: () => downloadText(csvFileName(station, dataset.release), stationToCsv(station)),
        }, 'Download CSV'),
        h('a', { class: 'btn', href: stationJsonUrl(station.id), download: `${station.id}.json` }, 'Download JSON'),
        copyButton));

    const notices: string[] = [];
    if (station.years < SHORT_RECORD_YEARS) {
      notices.push(`This is a short record (${station.years} years). Return periods much longer than the record, such as the 50- and 100-year values, are extrapolations.`);
    }
    const skipped = station.durations.filter((_, d) => !station.sampleYears[d]);
    if (skipped.length) notices.push(`ECCC did not analyse ${listDurations(skipped)} at this station.`);

    const built = new Set<TabId>();
    const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Station views' });
    const tabButtons = TABS.map((t, i) => h('button', {
      class: 'tab',
      role: 'tab',
      id: `tab-${t.id}`,
      'aria-controls': `panel-${t.id}`,
      type: 'button',
      onclick: () => select(t.id, true),
      onkeydown: (event: KeyboardEvent) => {
        const next = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 } as Record<string, number>)[event.key];
        if (next === undefined) return;
        event.preventDefault();
        const targetIndex = (next + TABS.length) % TABS.length;
        select((TABS[targetIndex] as { id: TabId }).id, true);
        tabButtons[targetIndex]?.focus();
      },
    }, t.label));
    tablist.append(...tabButtons);
    const panelEls = TABS.map((t) => h('div', {
      class: 'tabpanel', role: 'tabpanel', id: `panel-${t.id}`, 'aria-labelledby': `tab-${t.id}`, hidden: true,
    }));

    function select(id: TabId, notify: boolean): void {
      tab = id;
      TABS.forEach((t, i) => {
        const on = t.id === id;
        const button = tabButtons[i] as HTMLButtonElement;
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
        (panelEls[i] as HTMLElement).hidden = !on;
      });
      if (!built.has(id)) {
        built.add(id);
        build(id, panelEls[TABS.findIndex((t) => t.id === id)] as HTMLElement);
      }
      if (notify) onTabChange(id);
    }

    function build(id: TabId, el: HTMLElement): void {
      if (id === 'curves') buildCurves(el);
      else if (id === 'tables') el.append(buildTablesPanel(station));
      else if (id === 'annual') buildAnnual(el);
      else el.append(buildCalculator(station));
    }

    function buildCurves(el: HTMLElement): void {
      const holder = h('div');
      const chart: ChartController<IdfOptions> = renderIdfChart(holder, station);
      disposers.push(() => chart.destroy());
      const modes = ['intensity', 'depth'] as const;
      const modeButtons = modes.map((mode) => h('button', {
        type: 'button',
        'aria-pressed': String(mode === 'intensity'),
        onclick: () => {
          modeButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(modes[i] === mode)));
          chart.update({ mode });
        },
      }, mode === 'intensity' ? 'Intensity (mm/h)' : 'Depth (mm)'));
      const limits = h('select', {
        id: 'ci-select',
        onchange: (event: Event) => {
          const picked = (event.target as HTMLSelectElement).value;
          chart.update({ ciPeriod: picked ? Number(picked) : null });
        },
      }, h('option', { value: '' }, 'None'), station.returnPeriods.map((y) => h('option', { value: y }, returnPeriodLabel(y))));
      el.append(
        h('div', { class: 'chart-head' },
          h('div', {},
            h('h3', { class: 'chart-title' }, 'Rainfall intensity–duration–frequency'),
            h('p', { class: 'chart-sub' }, 'Longer storms are less intense; rarer storms are more intense.')),
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Quantity shown' }, ...modeButtons)),
        h('label', { class: 'inline-field', for: 'ci-select' }, '95 % limits for', limits),
        holder,
        h('p', { class: 'chart-note' }, `Gumbel distribution fitted by the method of moments to ${station.years} years of annual maxima (${station.firstYear}–${station.lastYear}). Values are from ECCC release ${dataset.release}.`));
    }

    function buildAnnual(el: HTMLElement): void {
      const durationSelect = h('select', { id: 'annual-duration' },
        station.durations.map((m, d) => h('option', { value: d, selected: m === 60 }, durationLabel(m))));
      const holder = h('div');
      const chart = renderAnnualChart(holder, station);
      disposers.push(() => chart.destroy());
      const caption = h('p', { class: 'chart-note' });
      const refresh = (): void => {
        const info = chart.summary();
        caption.textContent = `${info.years} of ${info.span} years in the record have a value for this duration.${info.over ? ` ${info.over} of them exceed the 100-year amount.` : ''}`;
      };
      durationSelect.addEventListener('change', () => {
        chart.update({ durationIndex: Number(durationSelect.value) });
        refresh();
      });
      refresh();
      el.append(
        h('div', { class: 'chart-head' },
          h('div', {},
            h('h3', { class: 'chart-title' }, 'Annual maximum rainfall depth'),
            h('p', { class: 'chart-sub' }, 'The largest depth recorded each year. Dashed lines are the 2-, 10- and 100-year depths.')),
          h('label', { class: 'inline-field', for: 'annual-duration' }, 'Duration', durationSelect)),
        h('ul', { class: 'legend-inline' },
          h('li', {}, h('i', { class: 'sq' }), 'Annual maximum'),
          h('li', {}, h('i', { class: 'sq over' }), 'Above the 100-year amount'),
          h('li', {}, h('i', { class: 'dash' }), 'Return-period depth')),
        holder,
        caption,
        h('details', {}, h('summary', {}, `Show all ${station.annualMaxYears.length} years as a table`), buildAnnualTable(station)));
    }

    clear(stationRoot).append(
      head,
      ...notices.map((text) => h('p', { class: 'notice' }, text)),
      tablist,
      ...panelEls);
    select(tab, false);
  }

  return {
    showEmpty,
    show,
    selectTab(id) {
      const button = stationRoot.querySelector<HTMLButtonElement>(`#tab-${id}`);
      if (button) button.click();
      else tab = id;
    },
    get tab() {
      return tab;
    },
  };
}

function fact(label: string, value: string): HTMLElement {
  return h('div', {}, h('dt', {}, label), h('dd', {}, value));
}

function listDurations(minutes: readonly number[]): string {
  const labels = minutes.map(durationLabel);
  if (labels.length === 1) return `the ${labels[0]} duration`;
  return `the ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]} durations`;
}
