// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile, downloadZip, fetchBytes } from './download';
import { buildFilesPanel } from './files-ui';
import { charlottetown, text } from './test-dom';

vi.mock('./download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./download')>()),
  downloadFile: vi.fn(async () => 12_345),
  downloadZip: vi.fn(async () => 1_234_567),
  fetchBytes: vi.fn(async () => Uint8Array.from([68, 111, 110, 110, 0xE9, 101, 115, 10, 50, 48, 50, 53])),
}));

const BASE = 'https://files.example.test';
const STEM = 'idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A';
const FOLDER = `${BASE}/v3.40/stations/8300301/`;

function mount() {
  const panel = buildFilesPanel(charlottetown, '3.40', BASE);
  document.body.replaceChildren(panel);
  const button = (label: string): HTMLButtonElement => [...panel.querySelectorAll('button')].find((b) => text(b) === label) as HTMLButtonElement;
  const link = (label: string): HTMLAnchorElement => [...panel.querySelectorAll('a')].find((a) => text(a) === label) as HTMLAnchorElement;
  return {
    panel,
    button,
    link,
    image: () => panel.querySelector('img') as HTMLImageElement,
    status: () => text(panel.querySelector('[role="status"]')),
    caption: () => text(panel.querySelector('figcaption')),
    plotButtons: () => [...panel.querySelectorAll('.seg button')] as HTMLButtonElement[],
    pressed: () => [...panel.querySelectorAll('.seg button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map(text),
    textBox: () => panel.querySelector('pre') as HTMLElement,
  };
}

describe('Files tab', () => {
  beforeEach(() => {
    vi.mocked(downloadFile).mockClear().mockResolvedValue(12_345);
    vi.mocked(downloadZip).mockClear().mockResolvedValue(1_234_567);
    vi.mocked(fetchBytes).mockClear();
  });

  describe('seeing the plots', () => {
    it('opens on the IDF graph, large, with what it shows', () => {
      const ui = mount();
      expect(ui.image().getAttribute('src')).toBe(`${FOLDER}${STEM}.png`);
      expect(ui.image().getAttribute('alt')).toBe("ECCC's idf graph for Charlottetown A");
      expect(ui.caption()).toMatch(/^IDF graph\. The official intensity-duration-frequency curves/);
      expect(ui.pressed()).toEqual(['IDF graph']);
    });

    it('offers all four plots to choose from', () => {
      expect(mount().plotButtons().map(text)).toEqual(['IDF graph', 'Q–Q plot', 'Return levels', 'Trend']);
    });

    it('shows the plot that is chosen, with its own image, explanation and PDF', () => {
      const ui = mount();
      ui.plotButtons()[1]?.click();
      expect(ui.image().getAttribute('src')).toBe(`${FOLDER}${STEM}_qq.png`);
      expect(ui.caption()).toContain('Quantile-quantile plot. Checks the Gumbel fit');
      expect(ui.link('Open PDF').getAttribute('href')).toBe(`${FOLDER}${STEM}_qq.pdf`);
      expect(ui.panel.querySelector('a.official-preview')?.getAttribute('href')).toBe(`${FOLDER}${STEM}_qq.pdf`);
      expect(ui.pressed()).toEqual(['Q–Q plot']);
      ui.plotButtons()[3]?.click();
      expect(ui.image().getAttribute('src')).toBe(`${FOLDER}${STEM}_t.png`);
      expect(ui.pressed()).toEqual(['Trend']);
    });

    it('opens the PDF in a new tab without handing over the opener', () => {
      const ui = mount();
      expect(ui.link('Open PDF').target).toBe('_blank');
      expect(ui.link('Open PDF').rel).toContain('noopener');
    });

    it('tells the viewer when a preview cannot be loaded, and clears it when another loads', () => {
      const ui = mount();
      const error = ui.panel.querySelector('.plot-error') as HTMLElement;
      expect(error.hidden).toBe(true);
      ui.image().dispatchEvent(new Event('error'));
      expect(error.hidden).toBe(false);
      expect(error.getAttribute('role')).toBe('alert');
      ui.plotButtons()[2]?.click();
      expect(error.hidden).toBe(true);
    });
  });

  describe('downloading one file', () => {
    it("downloads the chosen plot's PDF and PNG under ECCC's names", async () => {
      const ui = mount();
      ui.plotButtons()[2]?.click();
      ui.button('Download PDF').click();
      ui.button('Download PNG').click();
      expect(downloadFile).toHaveBeenNthCalledWith(1, { name: `${STEM}_r.pdf`, url: `${FOLDER}${STEM}_r.pdf` });
      expect(downloadFile).toHaveBeenNthCalledWith(2, { name: `${STEM}_r.png`, url: `${FOLDER}${STEM}_r.png` });
    });

    it('says what was saved and how big it was', async () => {
      const ui = mount();
      ui.button('Download PDF').click();
      expect(ui.status()).toBe(`Downloading ${STEM}.pdf…`);
      await vi.waitFor(() => expect(ui.status()).toBe(`Saved ${STEM}.pdf (12 kB).`));
    });

    it('says so, and points to the Open link, when a download fails', async () => {
      vi.mocked(downloadFile).mockRejectedValueOnce(new Error('HTTP 404'));
      const ui = mount();
      ui.button('Download PNG').click();
      await vi.waitFor(() => expect(ui.status()).toBe(`Could not download ${STEM}.png (HTTP 404). Try the Open link instead.`));
    });

    it('downloads the station file from its own button', async () => {
      const ui = mount();
      ui.button('Download TXT').click();
      expect(downloadFile).toHaveBeenCalledWith({ name: `${STEM}.txt`, url: `${FOLDER}${STEM}.txt` });
    });
  });

  describe('downloading everything', () => {
    it('packs all nine files into one ZIP and says how big it is', async () => {
      const ui = mount();
      ui.button('Download all files (ZIP)').click();
      expect(downloadZip).toHaveBeenCalledOnce();
      const [files, zipName] = vi.mocked(downloadZip).mock.calls[0] ?? [];
      expect(files).toHaveLength(9);
      expect(zipName).toBe('eccc-idf-v3.40-8300301-official-files.zip');
      expect(ui.status()).toBe('Preparing 9 files…');
      await vi.waitFor(() => expect(ui.status()).toBe('Saved eccc-idf-v3.40-8300301-official-files.zip (9 files, 1.2 MB).'));
    });

    it('cannot be pressed twice while it works, and can be pressed again afterwards', async () => {
      const ui = mount();
      const all = ui.button('Download all files (ZIP)');
      all.click();
      expect(all.disabled).toBe(true);
      await vi.waitFor(() => expect(all.disabled).toBe(false));
    });

    it('says which file was missing when the ZIP cannot be prepared', async () => {
      vi.mocked(downloadZip).mockRejectedValueOnce(new Error(`${STEM}_t.pdf: HTTP 404`));
      const ui = mount();
      ui.button('Download all files (ZIP)').click();
      await vi.waitFor(() => expect(ui.status()).toBe(`Could not prepare the ZIP (${STEM}_t.pdf: HTTP 404).`));
      expect(ui.button('Download all files (ZIP)').disabled).toBe(false);
    });
  });

  describe('reading the station file', () => {
    it('is hidden until asked for', () => {
      const ui = mount();
      expect(ui.textBox().hidden).toBe(true);
      expect(ui.button('View text').getAttribute('aria-expanded')).toBe('false');
    });

    it("shows the file's text with its accents intact, and fetches it only once", async () => {
      const ui = mount();
      ui.button('View text').click();
      await vi.waitFor(() => expect(ui.textBox().hidden).toBe(false));
      expect(ui.textBox().textContent).toBe('Données\n2025');
      expect(fetchBytes).toHaveBeenCalledExactlyOnceWith(`${FOLDER}${STEM}.txt`);
      ui.button('Hide text').click();
      expect(ui.textBox().hidden).toBe(true);
      ui.button('View text').click();
      await vi.waitFor(() => expect(ui.textBox().hidden).toBe(false));
      expect(fetchBytes).toHaveBeenCalledOnce();
    });

    it('can be scrolled and named by keyboard and screen-reader users', async () => {
      const ui = mount();
      expect(ui.textBox().tabIndex).toBe(0);
      expect(ui.textBox().getAttribute('role')).toBe('region');
      expect(ui.textBox().getAttribute('aria-label')).toBe('Station file for Charlottetown A');
    });

    it('says so, and stays closed, when the file cannot be loaded', async () => {
      vi.mocked(fetchBytes).mockRejectedValueOnce(new Error('HTTP 500'));
      const ui = mount();
      ui.button('View text').click();
      await vi.waitFor(() => expect(ui.status()).toBe('Could not load the station file (HTTP 500).'));
      expect(ui.textBox().hidden).toBe(true);
    });
  });

  describe('around the files', () => {
    it('explains where the files come from and links the whole release and the licence', () => {
      const ui = mount();
      expect(text(ui.panel.querySelector('.chart-sub'))).toBe("ECCC's own graphs and station file, unchanged from release 3.40.");
      const hrefs = [...ui.panel.querySelectorAll('a')].map((a) => a.href);
      expect(hrefs).toContain(`${BASE}/`);
      expect(hrefs).toContain('https://open.canada.ca/en/open-government-licence-canada');
      expect(text(ui.panel.querySelector('.chart-note'))).toContain('9 files for this station are hosted on Cloudflare');
    });

    it('keeps the heading order: a section title, then the station file under it', () => {
      const ui = mount();
      expect(text(ui.panel.querySelector('h3'))).toBe('Files for this station');
      expect(text(ui.panel.querySelector('h4'))).toBe('Station file (TXT)');
    });

    it('says so, instead of showing broken buttons, when a station has no ECCC file name', () => {
      const { officialFileStem: _stem, ...withoutStem } = charlottetown;
      const none = buildFilesPanel(withoutStem, '3.40', BASE);
      expect(text(none)).toBe('ECCC files are not available for this station.');
      expect(none.querySelectorAll('a, button')).toHaveLength(0);
    });
  });
});
