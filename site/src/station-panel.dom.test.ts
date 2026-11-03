// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadStation } from './data';
import { downloadText } from './export';
import { createStationPanel, TABS } from './station-panel';
import {
  FIXTURES, charlottetown, cowichan, installLayoutStubs, press, text,
} from './test-dom';
import type { DatasetInfo, StationSummary } from './types';

vi.mock('./data', async () => {
  const { FIXTURES: fixtures } = await import('./test-dom');
  return {
    loadStation: vi.fn(async (id: string) => {
      const station = fixtures[id];
      if (!station) throw new Error('HTTP 404');
      return station;
    }),
    stationJsonUrl: (id: string) => `https://example.test/data/stations/${id}.json`,
  };
});
vi.mock('./export', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./export')>()),
  downloadText: vi.fn(),
}));

const dataset: DatasetInfo = {
  release: '3.40',
  processingDate: '2025-12-05',
  latestYear: 2025,
  stationCount: 3,
  method: 'Gumbel - Method of moments',
  source: '',
  licence: 'Open Government Licence - Canada',
  licenceUrl: 'https://open.canada.ca/en/open-government-licence-canada',
};

const summary = (s: typeof charlottetown, depth24: number): StationSummary => ({
  id: s.id, name: s.name, province: s.province, lat: s.lat, lon: s.lon, firstYear: s.firstYear, lastYear: s.lastYear, years: s.years, composite: s.composite, depth100Yr24h: depth24,
});
const index = [summary(charlottetown, 128.1), summary(cowichan, 157.5)];

function mount() {
  document.body.innerHTML = '<div id="scroller"><div id="empty"></div><div id="station" hidden></div></div>';
  const emptyRoot = document.getElementById('empty') as HTMLElement;
  const stationRoot = document.getElementById('station') as HTMLElement;
  const scroller = document.getElementById('scroller') as HTMLElement;
  const onSelect = vi.fn();
  const onTabChange = vi.fn();
  const panel = createStationPanel({
    emptyRoot, stationRoot, scroller, dataset, index, onSelect, onTabChange,
  });
  const tabs = (): HTMLButtonElement[] => [...stationRoot.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const selectedTab = (): string => text(tabs().find((tab) => tab.getAttribute('aria-selected') === 'true') ?? null);
  const visiblePanel = (): HTMLElement | null => stationRoot.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');
  const button = (label: string): HTMLElement | undefined => [...stationRoot.querySelectorAll<HTMLElement>('button, a')].find((el) => text(el) === label);
  return {
    panel, emptyRoot, stationRoot, scroller, onSelect, onTabChange, tabs, selectedTab, visiblePanel, button,
  };
}

describe('station panel', () => {
  beforeEach(() => {
    installLayoutStubs();
    vi.mocked(loadStation).mockClear();
    vi.mocked(downloadText).mockClear();
    delete FIXTURES['9999999'];
  });

  describe('before a station is chosen', () => {
    it('invites a choice and offers the longest records and the heaviest storms as ways in', () => {
      const ui = mount();
      ui.panel.showEmpty();
      expect(ui.stationRoot.hidden).toBe(true);
      expect(ui.emptyRoot.hidden).toBe(false);
      expect(text(ui.emptyRoot.querySelector('h2'))).toBe('Rainfall design values for Canadian stations');
      expect([...ui.emptyRoot.querySelectorAll('h3')].map(text)).toEqual(['Longest records', 'Largest 100-year, 24-hour depths']);
      expect(text(ui.emptyRoot.querySelector('.stat-line'))).toContain('2 stations');
    });

    it('sorts the lists and selects a station when its row is pressed', () => {
      const ui = mount();
      ui.panel.showEmpty();
      const [longest, wettest] = [...ui.emptyRoot.querySelectorAll('.pick-list')];
      expect([...(longest?.querySelectorAll('.pick-name') ?? [])].map(text)).toEqual(['Charlottetown A, PE', 'Lake Cowichan, BC']);
      expect([...(wettest?.querySelectorAll('.pick-name') ?? [])].map(text)).toEqual(['Lake Cowichan, BC', 'Charlottetown A, PE']);
      expect(text(wettest?.querySelector('.pick-meta') ?? null)).toBe('157.5 mm');
      longest?.querySelector<HTMLButtonElement>('button')?.click();
      expect(ui.onSelect).toHaveBeenCalledExactlyOnceWith('8300301');
    });
  });

  describe('a station', () => {
    it('shows the name, province, climate ID and the series note', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      expect(ui.stationRoot.hidden).toBe(false);
      expect(ui.emptyRoot.hidden).toBe(true);
      expect(text(ui.stationRoot.querySelector('h2'))).toBe('Charlottetown A');
      expect(text(ui.stationRoot.querySelector('.station-sub'))).toBe('Prince Edward Island · Climate ID 8300301Joined records');
      expect(text(ui.stationRoot.querySelector('.badge'))).toBe('Joined records');
    });

    it('leads with the 100-year, 1-hour and 24-hour design values and their intensities', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const tiles = [...ui.stationRoot.querySelectorAll('.tile')].map((tile) => [...tile.children].map(text));
      expect(tiles).toEqual([
        ['100-year storm, 1 h', '40.5 mm', '40.5 mm/h'],
        ['100-year storm, 24 h', '128.1 mm', '5.3 mm/h'],
      ]);
    });

    it('lists the record, years of data, location and elevation', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const facts = Object.fromEntries([...ui.stationRoot.querySelectorAll('.station-facts div')].map((d) => [text(d.querySelector('dt')), text(d.querySelector('dd'))]));
      expect(facts).toEqual({
        Record: '1967–2016', 'Years of data': '31', Location: '46.28° N, 63.12° W', Elevation: '50 m',
      });
    });

    it('has no notices for a long record with every duration analysed', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      expect(ui.stationRoot.querySelectorAll('.notice')).toHaveLength(0);
    });

    it('warns about a short record and names the durations ECCC did not analyse', async () => {
      const ui = mount();
      await ui.panel.show('1012055');
      const notices = [...ui.stationRoot.querySelectorAll('.notice')].map(text);
      expect(notices).toHaveLength(2);
      expect(notices[0]).toContain('short record (14 years)');
      expect(notices[1]).toBe('ECCC did not analyse the 5 min, 10 min, 15 min and 30 min durations at this station.');
    });

    it('scrolls back to the top when another station opens', async () => {
      const ui = mount();
      ui.scroller.scrollTop = 400;
      await ui.panel.show('8300301');
      expect(ui.scroller.scrollTop).toBe(0);
    });

    it('shows the last station chosen when two requests overlap', async () => {
      const ui = mount();
      await Promise.all([ui.panel.show('8300301'), ui.panel.show('1012055')]);
      expect(text(ui.stationRoot.querySelector('h2'))).toBe('Lake Cowichan');
    });
  });

  describe('actions', () => {
    it('downloads the station as CSV under a name that carries the release and climate ID', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      ui.button('Download CSV')?.click();
      expect(downloadText).toHaveBeenCalledOnce();
      const [name, body] = vi.mocked(downloadText).mock.calls[0] ?? [];
      expect(name).toBe('eccc-idf-v3.40-8300301.csv');
      expect(String(body).split('\r\n')[0]).toContain('climate_id,station,province');
      expect(String(body).split('\r\n')).toHaveLength(1 + 63 + 1);
    });

    it('puts the ECCC files in the same row as the CSV and JSON downloads', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const row = [...ui.stationRoot.querySelectorAll('.station-actions > *')].map(text);
      expect(row).toEqual(['Download CSV', 'Download JSON', 'Download files', 'Copy link']);
    });

    it('opens the Files tab, tells the page, and puts the keyboard on the tab', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      expect(ui.selectedTab()).toBe('Curves');
      ui.button('Download files')?.click();
      expect(ui.selectedTab()).toBe('Files');
      expect(ui.visiblePanel()?.id).toBe('panel-files');
      expect(ui.visiblePanel()?.querySelector('img')).not.toBeNull();
      expect(ui.onTabChange).toHaveBeenCalledExactlyOnceWith('files');
      expect(document.activeElement?.id).toBe('tab-files');
    });

    it('has no Download files button for a station without ECCC file names', async () => {
      const { officialFileStem: _stem, ...withoutStem } = charlottetown;
      FIXTURES['9999999'] = { ...withoutStem, id: '9999999' };
      const ui = mount();
      await ui.panel.show('9999999');
      expect([...ui.stationRoot.querySelectorAll('.station-actions > *')].map(text)).toEqual(['Download CSV', 'Download JSON', 'Copy link']);
    });

    it('links the JSON file for download', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const link = ui.button('Download JSON') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('https://example.test/data/stations/8300301.json');
      expect(link.getAttribute('download')).toBe('8300301.json');
    });
  });

  describe('tabs', () => {
    it('offers curves, tables, annual maxima, the calculator and the files, curves first', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      expect(ui.tabs().map(text)).toEqual(['Curves', 'Tables', 'Annual', 'Calculator', 'Files']);
      expect(ui.selectedTab()).toBe('Curves');
      expect(ui.visiblePanel()?.id).toBe('panel-curves');
      expect(ui.visiblePanel()?.querySelector('svg')).not.toBeNull();
    });

    it('wires each tab to its panel for assistive technology', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      for (const tab of ui.tabs()) {
        const target = ui.stationRoot.querySelector(`#${tab.getAttribute('aria-controls')}`);
        expect(target?.getAttribute('role')).toBe('tabpanel');
        expect(target?.getAttribute('aria-labelledby')).toBe(tab.id);
      }
      expect(ui.tabs().filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    });

    it('shows a panel when its tab is pressed, tells the page, and builds it only then', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const tables = ui.stationRoot.querySelector('#panel-tables') as HTMLElement;
      expect(tables.childElementCount).toBe(0);
      ui.tabs()[1]?.click();
      expect(ui.selectedTab()).toBe('Tables');
      expect(ui.visiblePanel()?.id).toBe('panel-tables');
      expect(tables.querySelectorAll('table')).toHaveLength(3);
      expect(ui.onTabChange).toHaveBeenCalledExactlyOnceWith('tables');
    });

    it('moves with the arrow keys, Home and End, and wraps', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      press(ui.tabs()[0] as Element, 'ArrowRight');
      expect(ui.selectedTab()).toBe('Tables');
      press(ui.tabs()[1] as Element, 'End');
      expect(ui.selectedTab()).toBe('Files');
      press(ui.tabs()[4] as Element, 'ArrowRight');
      expect(ui.selectedTab()).toBe('Curves');
      press(ui.tabs()[0] as Element, 'ArrowLeft');
      expect(ui.selectedTab()).toBe('Files');
      press(ui.tabs()[4] as Element, 'Home');
      expect(ui.selectedTab()).toBe('Curves');
    });

    it('keeps the chosen tab when another station opens', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      ui.tabs()[3]?.click();
      await ui.panel.show('1012055');
      expect(ui.selectedTab()).toBe('Calculator');
    });

    it('follows the address without reporting back, so the address is never rewritten', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      ui.panel.selectTab('calc');
      expect(ui.selectedTab()).toBe('Calculator');
      expect(ui.onTabChange).not.toHaveBeenCalled();
    });

    it('can be set from the address before the station has loaded', async () => {
      const ui = mount();
      ui.panel.selectTab('annual');
      await ui.panel.show('8300301');
      expect(ui.selectedTab()).toBe('Annual');
      expect(ui.panel.tab).toBe('annual');
    });

    it('drops the Official tab, and falls back to curves, for a station without ECCC file names', async () => {
      const { officialFileStem: _stem, ...withoutStem } = charlottetown;
      FIXTURES['9999999'] = { ...withoutStem, id: '9999999' };
      const ui = mount();
      ui.panel.selectTab('files');
      await ui.panel.show('9999999');
      expect(ui.tabs().map(text)).toEqual(['Curves', 'Tables', 'Annual', 'Calculator']);
      expect(ui.selectedTab()).toBe('Curves');
    });

    it('shows the files viewer on the Files tab, with the graph and the four plots to choose from', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      ui.tabs()[4]?.click();
      const files = ui.visiblePanel();
      expect(files?.querySelector('img')?.getAttribute('src')).toContain('/v3.40/stations/8300301/idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A.png');
      expect(files?.querySelectorAll('.seg button')).toHaveLength(4);
      expect(text(files?.querySelector('h3') ?? null)).toBe('Files for this station');
    });
  });

  describe('curves tab', () => {
    it('switches between intensity and depth', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const [intensity, depth] = [...(ui.visiblePanel()?.querySelectorAll('.seg button') ?? [])] as HTMLElement[];
      expect(intensity?.getAttribute('aria-pressed')).toBe('true');
      depth?.click();
      expect(intensity?.getAttribute('aria-pressed')).toBe('false');
      expect(depth?.getAttribute('aria-pressed')).toBe('true');
      expect([...ui.visiblePanel()!.querySelectorAll('text.axis-title')].map(text)).toContain('Rainfall depth (mm)');
    });

    it('draws the confidence band for the return period picked', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const select = ui.visiblePanel()?.querySelector('#ci-select') as HTMLSelectElement;
      expect(ui.visiblePanel()?.querySelectorAll('path.band')).toHaveLength(0);
      select.value = '100';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(ui.visiblePanel()?.querySelectorAll('path.band')).toHaveLength(1);
    });

    it('shows ECCC\'s fitted equations, and a switch that takes the lines off the chart', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const curves = ui.visiblePanel() as HTMLElement;
      const toggle = curves.querySelector('#fit-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(true);
      expect(curves.querySelectorAll('path.fit')).toHaveLength(7);
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
      expect(curves.querySelectorAll('path.fit')).toHaveLength(0);
    });

    it('lists every equation in words, so the lines have a text alternative', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const list = ui.visiblePanel()?.querySelector('details.equations') as HTMLElement;
      expect(text(list.querySelector('summary'))).toBe("ECCC's fitted equations");
      const items = [...list.querySelectorAll('li')].map(text);
      expect(items).toHaveLength(7);
      expect(items[0]).toBe('2-yearR = 17.4 × T^−0.551');
      expect(items[5]).toBe('100-yearR = 40.1 × T^−0.578');
      expect(text(list.querySelector('p'))).toContain('depth in mm is R × T');
    });

    it('points to the IDF_CC tool for climate-change-adjusted curves', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      const link = ui.visiblePanel()?.querySelector<HTMLAnchorElement>('a[href="https://www.idf-cc-uwo.ca"]');
      expect(text(link ?? null)).toBe('IDF_CC tool');
      expect(link?.rel).toContain('noopener');
    });
  });

  describe('annual tab', () => {
    it('counts the years with a value for the chosen duration and offers the full table', async () => {
      const ui = mount();
      await ui.panel.show('8300301');
      ui.tabs()[2]?.click();
      const annual = ui.visiblePanel() as HTMLElement;
      expect(text(annual.querySelector('.chart-note'))).toBe('31 of 50 years in the record have a value for this duration.');
      expect(text(annual.querySelector('summary'))).toBe('Show all 32 years as a table');
      const select = annual.querySelector('#annual-duration') as HTMLSelectElement;
      select.value = String(charlottetown.durations.indexOf(1440));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      expect(text(annual.querySelector('.chart-note'))).toBe('32 of 50 years in the record have a value for this duration.');
    });
  });

  describe('when a station cannot be loaded', () => {
    it('says so, in an alert, and offers to try again', async () => {
      const ui = mount();
      await ui.panel.show('0000000');
      const alert = ui.stationRoot.querySelector('[role="alert"]');
      expect(text(alert)).toBe('Could not load station 0000000. HTTP 404');
      ui.button('Try again')?.click();
      await vi.waitFor(() => expect(loadStation).toHaveBeenCalledTimes(2));
    });
  });
});

describe('tab list', () => {
  it('has a stable set of ids the address bar can use', () => {
    expect(TABS.map((tab) => tab.id)).toEqual(['curves', 'tables', 'annual', 'calc', 'files']);
  });
});
