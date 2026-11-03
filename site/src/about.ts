// The two About dialogs: one about the data, one about the author. Each is opened from its own menu item.
import { h } from './dom';
import { AUTHOR, ECCC_DATASETS_URL, IDF_CC_URL } from './links';
import type { DatasetInfo } from './types';

const link = (href: string, text: string): HTMLAnchorElement => h('a', { href, rel: 'noopener' }, text);

function aboutTheData(dataset: DatasetInfo): HTMLElement {
  return h('section', { class: 'about-section' },
    h('p', {}, `This explorer shows Environment and Climate Change Canada's Short Duration Rainfall Intensity-Duration-Frequency (IDF) data, release ${dataset.release}, processed ${dataset.processingDate}: ${dataset.stationCount} stations, 5 minute to 24 hour durations, 2- to 200-year return periods.`),
    h('p', {}, `ECCC fits a Gumbel distribution by the method of moments to each station's annual maxima. The latest year of data in any station file is ${dataset.latestYear}.`),
    h('ul', {},
      h('li', {}, 'This is an independent project. It is not affiliated with or endorsed by ECCC.'),
      h('li', {}, "For design work, read ECCC's guidance on using IDF curves and cite the official files."),
      h('li', {}, 'Station coordinates are published to the nearest minute (about 1.8 km).'),
      h('li', {}, "Every value shown here was cross-checked against ECCC's own flat all-station tables when the data was built.")),
    h('p', {}, 'Data: ', link(ECCC_DATASETS_URL, 'ECCC Engineering Climate Datasets'),
      ', used under the ', link(dataset.licenceUrl, dataset.licence), '. Base map: ', link('https://openfreemap.org', 'OpenFreeMap'),
      ', © ', link('https://www.openmaptiles.org/', 'OpenMapTiles'), ', data © ', link('https://www.openstreetmap.org/copyright', 'OpenStreetMap'), ' contributors.'));
}

function relatedTool(): HTMLElement {
  return h('section', { class: 'about-section' },
    h('h3', {}, 'Curves for a changing climate'),
    h('p', {}, "ECCC's curves describe the rainfall of the past. To update IDF curves for climate change, at gauged and ungauged locations, use the ",
      link(IDF_CC_URL, 'IDF_CC tool'), ', developed at Western University.'));
}

function authorIntroduction(): HTMLElement {
  return h('section', { class: 'about-section' },
    h('p', {}, `${AUTHOR.name} is a senior software engineer and a licensed professional engineer (P.Eng.). He builds engineering software for hydrology, flood risk and climate change adaptation.`));
}

function authorLinks(): HTMLElement {
  return h('section', { class: 'about-section' },
    h('h3', {}, 'Elsewhere'),
    h('ul', { class: 'link-row' },
      h('li', {}, link(AUTHOR.website, 'andreschardong.com')),
      h('li', {}, link(AUTHOR.github, 'GitHub')),
      h('li', {}, link(AUTHOR.linkedIn, 'LinkedIn'))));
}

/** Content of the "About the data" dialog: the data, its limits and where to go for climate-change curves. */
export function buildAboutData(dataset: DatasetInfo): HTMLElement[] {
  return [aboutTheData(dataset), relatedTool()];
}

/** Content of the "About the author" dialog. */
export function buildAboutAuthor(): HTMLElement[] {
  return [authorIntroduction(), authorLinks()];
}
