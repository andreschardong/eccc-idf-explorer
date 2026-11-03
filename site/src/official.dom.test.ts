// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildOfficialPanel } from './official-ui';
import { charlottetown, text } from './test-dom';
import { officialFiles } from './official-files';

const BASE = 'https://files.example.test';
const STEM = 'idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A';
const links = (element: Element): HTMLAnchorElement[] => [...element.querySelectorAll('a')];

describe('officialFiles (addresses)', () => {
  const files = officialFiles(BASE, '3.40', '8300301', STEM);

  it('puts every file under the release and the climate ID, with ECCC\'s own names', () => {
    expect(files.text).toBe(`${BASE}/v3.40/stations/8300301/${STEM}.txt`);
    expect(files.plots.map((plot) => plot.pdf.replace(`${BASE}/v3.40/stations/8300301/`, ''))).toEqual([
      `${STEM}.pdf`, `${STEM}_qq.pdf`, `${STEM}_r.pdf`, `${STEM}_t.pdf`,
    ]);
    expect(files.plots.map((plot) => plot.png.split('/').at(-1))).toEqual([
      `${STEM}.png`, `${STEM}_qq.png`, `${STEM}_r.png`, `${STEM}_t.png`,
    ]);
  });

  it('names the four plots', () => {
    expect(files.plots.map((plot) => plot.title)).toEqual(['IDF graph', 'Quantile-quantile plot', 'Return-level plot', 'Trend plot']);
  });

  it('ignores a trailing slash on the host and points the index at its root', () => {
    expect(officialFiles(`${BASE}/`, '3.40', '8300301', STEM).text).toBe(files.text);
    expect(files.index).toBe(`${BASE}/`);
  });

  it('escapes characters that are not safe in an address', () => {
    const odd = officialFiles(BASE, '3.40', '8300301', 'idf_v3-40_x_(AUT) A&B');
    expect(odd.text).toContain('idf_v3-40_x_(AUT)%20A%26B.txt');
  });
});

describe('Official tab', () => {
  const panel = buildOfficialPanel(charlottetown, '3.40', BASE);

  it('previews the official IDF graph, which opens the PDF', () => {
    const preview = panel.querySelector<HTMLAnchorElement>('a.official-preview');
    expect(preview?.href).toBe(`${BASE}/v3.40/stations/8300301/${STEM}.pdf`);
    expect(preview?.getAttribute('aria-label')).toContain('Charlottetown A');
    const image = preview?.querySelector('img');
    expect(image?.getAttribute('src')).toBe(`${BASE}/v3.40/stations/8300301/${STEM}.png`);
    expect(image?.getAttribute('alt')).toContain("ECCC's IDF graph for Charlottetown A");
    expect(image?.getAttribute('loading')).toBe('lazy');
  });

  it('lists the four plots and the station file, each with a name and a plain-language description', () => {
    const rows = [...panel.querySelectorAll('.file-row')];
    expect(rows.map((row) => text(row.querySelector('strong')))).toEqual([
      'IDF graph', 'Quantile-quantile plot', 'Return-level plot', 'Trend plot', 'Station file',
    ]);
    expect(rows.every((row) => text(row.querySelector('p')).length > 30)).toBe(true);
  });

  it('offers PDF and PNG for each plot and a downloadable text file', () => {
    const rows = [...panel.querySelectorAll('.file-row')];
    for (const row of rows.slice(0, 4)) expect(links(row).map(text)).toEqual(['PDF', 'PNG']);
    const station = links(rows[4] as Element)[0];
    expect(text(station ?? null)).toBe('TXT');
    expect(station?.hasAttribute('download')).toBe(true);
  });

  it('opens outside links in a new tab without handing over the opener', () => {
    for (const anchor of panel.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')) {
      expect(anchor.rel).toContain('noopener');
    }
  });

  it('links to the whole release and to the licence, and says the files are unchanged', () => {
    const hrefs = links(panel).map((a) => a.href);
    expect(hrefs).toContain(`${BASE}/`);
    expect(hrefs).toContain('https://open.canada.ca/en/open-government-licence-canada');
    expect(text(panel)).toContain('Unchanged from release 3.40');
  });

  it('says so, instead of showing broken links, when the station has no ECCC file name', () => {
    const { officialFileStem: _stem, ...withoutStem } = charlottetown;
    const none = buildOfficialPanel(withoutStem, '3.40', BASE);
    expect(text(none)).toBe('ECCC files are not available for this station.');
    expect(none.querySelectorAll('a')).toHaveLength(0);
  });
});
