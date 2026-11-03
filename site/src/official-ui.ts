// The "Official" tab: ECCC's own graphs and station file, hosted unchanged outside this repository.
import { h } from './dom';
import { prettyName } from './format';
import { officialFiles } from './official-files';
import type { StationDetail } from './types';

export function buildOfficialPanel(station: StationDetail, release: string, base: string): HTMLElement {
  const stem = station.officialFileStem;
  if (stem === undefined) {
    return h('p', { class: 'chart-note' }, 'ECCC files are not available for this station.');
  }

  const files = officialFiles(base, release, station.id, stem);
  const [graph, ...others] = files.plots;
  const name = prettyName(station.name);

  return h('div', { class: 'official' },
    h('div', { class: 'chart-head' }, h('div', {},
      h('h3', { class: 'chart-title' }, "ECCC's own graphs and file"),
      h('p', { class: 'chart-sub' }, `Unchanged from release ${release}. Use these when you need to cite ECCC directly.`))),
    graph ? h('a', {
      class: 'official-preview',
      href: graph.pdf,
      target: '_blank',
      rel: 'noopener',
      'aria-label': `Open the official IDF graph for ${name} as a PDF`,
    }, h('img', {
      src: graph.png,
      alt: `ECCC's IDF graph for ${name}: rainfall intensity against storm duration for each return period.`,
      loading: 'lazy',
      decoding: 'async',
      width: 1050,
      height: 700,
    })) : null,
    h('ul', { class: 'file-list' },
      graph ? fileRow(graph.title, graph.description, graph.pdf, graph.png) : null,
      ...others.map((plot) => fileRow(plot.title, plot.description, plot.pdf, plot.png)),
      h('li', { class: 'file-row' },
        h('div', {},
          h('strong', {}, 'Station file'),
          h('p', {}, "The text file this site's numbers are read from: annual maxima, return-period tables and the interpolation fit.")),
        h('div', { class: 'file-links' }, h('a', { class: 'btn', href: files.text, download: '' }, 'TXT')))),
    h('p', { class: 'chart-note' },
      'Files are hosted on Cloudflare. ',
      h('a', { href: files.index, rel: 'noopener' }, 'Browse the whole release'),
      '. Contains information licensed under the ',
      h('a', { href: 'https://open.canada.ca/en/open-government-licence-canada', rel: 'noopener' }, 'Open Government Licence – Canada'),
      '.'));
}

function fileRow(title: string, description: string, pdf: string, png: string): HTMLElement {
  return h('li', { class: 'file-row' },
    h('div', {}, h('strong', {}, title), h('p', {}, description)),
    h('div', { class: 'file-links' },
      h('a', { class: 'btn', href: pdf, target: '_blank', rel: 'noopener' }, 'PDF'),
      h('a', { class: 'btn', href: png, target: '_blank', rel: 'noopener' }, 'PNG')));
}
