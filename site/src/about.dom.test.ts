// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildAbout } from './about';
import { text } from './test-dom';
import type { DatasetInfo } from './types';

const dataset: DatasetInfo = {
  release: '3.40',
  processingDate: '2025-12-05',
  latestYear: 2025,
  stationCount: 751,
  method: 'Gumbel - Method of moments',
  source: 'https://collaboration.cmc.ec.gc.ca/cmc/climate/Engineer_Climate/IDF/',
  licence: 'Open Government Licence - Canada',
  licenceUrl: 'https://open.canada.ca/en/open-government-licence-canada',
};

describe('About dialog content', () => {
  const sections = buildAbout(dataset);
  const links = (section: Element | undefined): Record<string, string> => Object.fromEntries(
    [...(section?.querySelectorAll('a') ?? [])].map((a) => [text(a), a.href]),
  );

  it('has the data, the related tool and the author, in that order, each under its own heading', () => {
    expect(sections.map((section) => text(section.querySelector('h3')))).toEqual([
      'About the data', 'Curves for a changing climate', 'About the author',
    ]);
  });

  it('states the release, the station count and the independence from ECCC', () => {
    const body = text(sections[0] ?? null);
    expect(body).toContain('release 3.40');
    expect(body).toContain('751 stations');
    expect(body).toContain('not affiliated with or endorsed by ECCC');
    expect(body).toContain('latest year of data in any station file is 2025');
  });

  it('credits the data licence and the base map', () => {
    const found = links(sections[0]);
    expect(found['Open Government Licence - Canada']).toBe(dataset.licenceUrl);
    expect(found['OpenFreeMap']).toBe('https://openfreemap.org/');
    expect(Object.keys(found)).toContain('OpenStreetMap');
  });

  it('points to the IDF_CC tool', () => {
    expect(links(sections[1])['IDF_CC tool']).toBe('https://www.idf-cc-uwo.ca/');
    expect(text(sections[1] ?? null)).toContain('climate change');
  });

  it('introduces the author with exactly these professional facts', () => {
    const intro = text(sections[2]?.querySelectorAll('p')[0] ?? null);
    expect(intro).toBe(
      'Andre Schardong is a senior software engineer and a licensed professional engineer (P.Eng.). '
      + 'He builds engineering software for hydrology, flood risk and climate change adaptation, '
      + 'and is the lead author of the paper that describes the IDF_CC tool:',
    );
  });

  it('cites the IDF_CC paper in full with a DOI link', () => {
    const citation = text(sections[2]?.querySelector('.citation') ?? null);
    expect(citation).toContain('Schardong, A., Simonovic, S. P., Gaur, A. and Sandink, D. (2020)');
    expect(citation).toContain('Web-Based Tool for the Development of Intensity Duration Frequency Curves');
    expect(citation).toContain('Water 12(5), 1243');
    expect(sections[2]?.querySelector<HTMLAnchorElement>('.citation a')?.href).toBe('https://doi.org/10.3390/w12051243');
  });

  it('links to the author\'s own website, GitHub and LinkedIn', () => {
    expect(links(sections[2]['querySelector']?.('.link-row') ? sections[2] : undefined)).toMatchObject({
      'andreschardong.com': 'https://andreschardong.com/',
      GitHub: 'https://github.com/andreschardong',
      LinkedIn: 'https://www.linkedin.com/in/andreschardong',
    });
  });

  it('opens every external link safely', () => {
    for (const section of sections) {
      for (const anchor of section.querySelectorAll('a')) expect(anchor.rel).toContain('noopener');
    }
  });
});
