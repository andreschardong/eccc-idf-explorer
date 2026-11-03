import '@fontsource-variable/atkinson-hyperlegible-next';
import './styles.css';
import { loadDataset, loadIndex } from './data';
import { buildAboutAuthor, buildAboutData } from './about';
import { append, byId, clear, h } from './dom';
import { provinceName } from './format';
import { createMap, type ColorMode, type LegendInfo } from './map';
import { createSearch } from './search';
import { isTabId, createStationPanel } from './station-panel';
import { toggleTheme, watchSystemTheme } from './theme';
import type { DatasetInfo } from './types';

async function start(): Promise<void> {
  const [dataset, index] = await Promise.all([loadDataset(), loadIndex()]);
  byId('release-line').textContent = `ECCC release ${dataset.release} · ${index.length} stations`;
  document.title = `ECCC Rainfall IDF Explorer · release ${dataset.release}`;

  let currentId: string | null = null;
  const routeFor = (id: string, tab: string): string => `#/station/${encodeURIComponent(id)}/${tab}`;

  const panel = createStationPanel({
    emptyRoot: byId('panel-empty'),
    stationRoot: byId('panel-station'),
    scroller: byId('station-panel'),
    dataset,
    index,
    onSelect: (id) => navigate(id),
    onTabChange: (tab) => {
      if (currentId) history.replaceState(null, '', routeFor(currentId, tab));
    },
  });

  const map = createMap(byId('map'), index, {
    onSelect: (id) => navigate(id),
    onLegend: renderLegend,
  });

  const province = byId<HTMLSelectElement>('province-filter');
  const groups = Object.groupBy(index, (station) => station.province);
  Object.keys(groups)
    .sort((a, b) => provinceName(a).localeCompare(provinceName(b)))
    .forEach((code) => province.append(h('option', { value: code }, `${provinceName(code)} (${groups[code]?.length ?? 0})`)));
  province.addEventListener('change', () => map.setProvince(province.value));
  byId<HTMLSelectElement>('color-by').addEventListener('change', (event) => {
    map.setMode((event.target as HTMLSelectElement).value as ColorMode);
  });

  createSearch({
    input: byId<HTMLInputElement>('search-input'),
    list: byId('search-list'),
    stations: index,
    onPick: (id) => navigate(id),
  });

  function navigate(id: string): void {
    const next = routeFor(id, panel.tab);
    if (location.hash === next) void route();
    else location.hash = next;
  }

  // The first route is the page loading, not a choice, so it must not take focus from the page.
  let loading = true;

  async function route(): Promise<void> {
    const isLoad = loading;
    loading = false;
    const match = /^#\/station\/([^/]+)(?:\/([a-z]+))?$/.exec(location.hash);
    const id = match?.[1] ? decodeURIComponent(match[1]) : null;
    const station = id ? index.find((s) => s.id === id) : undefined;
    if (!id || !station) {
      currentId = null;
      panel.showEmpty();
      map.select(null, { pan: false });
      return;
    }
    if (isTabId(match?.[2])) panel.selectTab(match[2]);
    if (province.value && province.value !== station.province) {
      province.value = '';
      map.setProvince('');
    }
    currentId = id;
    map.select(id, { pan: true });
    await panel.show(id);
    if (!isLoad) byId('station-title').focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 900px)').matches) {
      byId('station-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  window.addEventListener('hashchange', () => void route());
  await route();

  byId('theme-toggle').addEventListener('click', () => {
    toggleTheme();
    map.refreshTheme();
  });
  watchSystemTheme(() => map.refreshTheme());

  setupAbout(dataset);
}

function renderLegend(info: LegendInfo): void {
  const legend = clear(byId('legend'));
  const swatches = info.classes.map((c) => h('span', { class: 'legend-step', style: `background:${c.color}`, title: c.label }));
  const ticks = info.breaks.map((value, i) => h('span', {
    class: 'legend-tick',
    style: `left:${((i + 1) / info.classes.length) * 100}%`,
  }, String(value)));
  append(legend, [
    h('div', { class: 'legend-title' }, info.unit === 'mm' ? `${info.title} (mm)` : info.title),
    h('div', { class: 'legend-bar', role: 'img', 'aria-label': info.classes.map((c) => c.label).join(', ') }, ...swatches),
    h('div', { class: 'legend-ticks', 'aria-hidden': 'true' }, ...ticks),
    h('div', { class: 'legend-groups' },
      h('span', { class: 'legend-group-title' }, 'Numbered circles group stations; zoom in to separate them'),
      h('ul', { 'aria-label': 'Group sizes' }, ...info.groups.map((g) => h('li', {}, h('i', { style: `background:${g.color}` }), g.label)))),
    info.missingColor
      ? h('div', { class: 'legend-missing' }, h('span', { class: 'legend-dot', style: `background:${info.missingColor}` }), 'Not analysed')
      : null,
  ]);
}

function setupAbout(dataset: DatasetInfo): void {
  const dialog = byId<HTMLDialogElement>('about');
  // One dialog, filled for whichever menu item opened it.
  const open = (title: string, content: HTMLElement[]): void => {
    byId('about-title').textContent = title;
    append(clear(byId('about-body')), content);
    dialog.showModal();
  };
  byId('about-data-open').addEventListener('click', () => open('About the data', buildAboutData(dataset)));
  byId('about-author-open').addEventListener('click', () => open('About the author', buildAboutAuthor()));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

start().catch((error: unknown) => {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  clear(byId('panel-empty')).append(h('div', { class: 'pane-section' },
    h('p', { role: 'alert' }, `Could not start the explorer. ${message}`),
    h('p', { class: 'muted-text' }, 'If you opened index.html from a file, run the site with a web server instead (npm run dev).')));
});
