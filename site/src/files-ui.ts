// The Files tab: see and download every file ECCC publishes for a station.
import {
  decodeLatin1, downloadFile, downloadZip, fetchBytes, formatBytes,
} from './download';
import { h } from './dom';
import { prettyName } from './format';
import { officialFiles, zipFileName, type OfficialFile, type PlotFile } from './official-files';
import type { StationDetail } from './types';

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function buildFilesPanel(station: StationDetail, release: string, base: string): HTMLElement {
  const stem = station.officialFileStem;
  if (stem === undefined) {
    return h('p', { class: 'chart-note' }, 'ECCC files are not available for this station.');
  }

  const files = officialFiles(base, release, station.id, stem);
  const name = prettyName(station.name);
  const zipName = zipFileName(release, station.id);
  let current: PlotFile = files.plots[0] as PlotFile;

  // One polite status line announces what a download is doing, for sighted and screen-reader users alike.
  const status = h('p', { class: 'files-status', role: 'status' });
  const say = (message: string): void => {
    status.textContent = message;
  };

  const save = async (file: OfficialFile): Promise<void> => {
    say(`Downloading ${file.name}…`);
    try {
      say(`Saved ${file.name} (${formatBytes(await downloadFile(file))}).`);
    } catch (error) {
      say(`Could not download ${file.name} (${reason(error)}). Try the Open link instead.`);
    }
  };

  // ---- The plots: one is shown at a time, large, with its explanation.
  const image = h('img', { alt: '', loading: 'lazy', decoding: 'async', width: 1050, height: 700 });
  const preview = h('a', { class: 'official-preview', target: '_blank', rel: 'noopener' }, image);
  const caption = h('figcaption');
  const previewError = h('p', { class: 'plot-error', role: 'alert', hidden: true },
    'The preview could not be loaded. The download buttons below may still work.');
  image.addEventListener('error', () => { previewError.hidden = false; });
  image.addEventListener('load', () => { previewError.hidden = true; });

  const openPdf = h('a', { class: 'btn', target: '_blank', rel: 'noopener' }, 'Open PDF');
  const downloadPdf = h('button', { class: 'btn', type: 'button' }, 'Download PDF');
  const downloadPng = h('button', { class: 'btn', type: 'button' }, 'Download PNG');
  downloadPdf.addEventListener('click', () => void save({ name: current.pdfName, url: current.pdf }));
  downloadPng.addEventListener('click', () => void save({ name: current.pngName, url: current.png }));

  const plotButtons = files.plots.map((plot) => h('button', {
    type: 'button',
    'aria-pressed': 'false',
    onclick: () => show(plot),
  }, plot.short));

  function show(plot: PlotFile): void {
    current = plot;
    previewError.hidden = true;
    image.src = plot.png;
    image.alt = `ECCC's ${plot.title.toLowerCase()} for ${name}`;
    preview.href = plot.pdf;
    preview.setAttribute('aria-label', `Open the ${plot.title.toLowerCase()} for ${name} as a PDF`);
    caption.textContent = `${plot.title}. ${plot.description}`;
    openPdf.href = plot.pdf;
    plotButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(files.plots[i] === plot)));
  }

  // ---- The station's text file: read it here, or take it.
  const text = h('pre', { class: 'station-text', hidden: true, tabindex: 0, role: 'region', 'aria-label': `Station file for ${name}` });
  const toggleText = h('button', { class: 'btn', type: 'button', 'aria-expanded': 'false' }, 'View text');
  const downloadText = h('button', { class: 'btn', type: 'button' }, 'Download TXT');
  downloadText.addEventListener('click', () => void save({ name: files.textName, url: files.text }));
  toggleText.addEventListener('click', () => {
    if (!text.hidden) {
      text.hidden = true;
      toggleText.setAttribute('aria-expanded', 'false');
      toggleText.textContent = 'View text';
      return;
    }
    void (async () => {
      if (!text.textContent) {
        say(`Loading ${files.textName}…`);
        try {
          text.textContent = decodeLatin1(await fetchBytes(files.text));
          say('');
        } catch (error) {
          say(`Could not load the station file (${reason(error)}).`);
          return;
        }
      }
      text.hidden = false;
      toggleText.setAttribute('aria-expanded', 'true');
      toggleText.textContent = 'Hide text';
    })();
  });

  // ---- Everything at once.
  const downloadAll = h('button', { class: 'btn btn-primary', type: 'button' }, 'Download all files (ZIP)');
  downloadAll.addEventListener('click', () => {
    downloadAll.disabled = true;
    say(`Preparing ${files.all.length} files…`);
    void downloadZip(files.all, zipName)
      .then((size) => say(`Saved ${zipName} (${files.all.length} files, ${formatBytes(size)}).`))
      .catch((error: unknown) => say(`Could not prepare the ZIP (${reason(error)}).`))
      .finally(() => { downloadAll.disabled = false; });
  });

  show(current);

  return h('div', { class: 'files' },
    h('div', { class: 'chart-head' },
      h('div', {},
        h('h3', { class: 'chart-title' }, 'Files for this station'),
        h('p', { class: 'chart-sub' }, `ECCC's own graphs and station file, unchanged from release ${release}.`)),
      downloadAll),
    status,
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Plot' }, ...plotButtons),
    h('figure', { class: 'plot' }, preview, previewError, caption),
    h('div', { class: 'file-links' }, openPdf, downloadPdf, downloadPng),
    h('section', { class: 'station-file' },
      h('h4', {}, 'Station file (TXT)'),
      h('p', {}, "The text file this site's numbers are read from: annual maxima, return-period tables and the interpolation fit."),
      h('div', { class: 'file-links' }, toggleText, downloadText),
      text),
    h('p', { class: 'chart-note' },
      `${files.all.length} files for this station are hosted on Cloudflare. `,
      h('a', { href: files.index, rel: 'noopener' }, 'Browse the whole release'),
      '. Contains information licensed under the ',
      h('a', { href: 'https://open.canada.ca/en/open-government-licence-canada', rel: 'noopener' }, 'Open Government Licence – Canada'),
      '.'));
}
