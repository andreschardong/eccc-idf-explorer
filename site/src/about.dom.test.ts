// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildAboutAuthor, buildAboutData } from './about';
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

const links = (section: Element | undefined): Record<string, string> => Object.fromEntries(
  [...(section?.querySelectorAll('a') ?? [])].map((a) => [text(a), a.href]),
);

describe('About the data', () => {
  const sections = buildAboutData(dataset);

  it('has the data notes, then a pointer to climate-change curves under its own heading', () => {
    expect(sections).toHaveLength(2);
    expect(sections[0]?.querySelector('h3')).toBeNull();
    expect(text(sections[1]?.querySelector('h3') ?? null)).toBe('Curves for a changing climate');
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

  it('says nothing about the author', () => {
    expect(sections.map(text).join(' ')).not.toContain('Schardong');
  });

  it('opens every external link safely', () => {
    for (const section of sections) {
      for (const anchor of section.querySelectorAll('a')) expect(anchor.rel).toContain('noopener');
    }
  });
});

describe('About the author', () => {
  const sections = buildAboutAuthor();

  it('has an introduction and the links', () => {
    expect(sections).toHaveLength(2);
    expect(sections.map((s) => text(s.querySelector('h3')))).toEqual(['', 'Elsewhere']);
  });

  it('introduces the author with exactly these professional facts', () => {
    expect(text(sections[0]?.querySelector('p') ?? null)).toBe(
      'Andre Schardong is a senior software engineer and a licensed professional engineer (P.Eng.). '
      + 'He builds engineering software for hydrology, flood risk and climate change adaptation.',
    );
  });

  it('does not mention the IDF_CC paper', () => {
    const body = sections.map(text).join(' ');
    expect(body).not.toContain('paper');
    expect(body).not.toContain('doi.org');
    expect(body).not.toContain('Simonovic');
  });

  it("links to the author's own website, GitHub and LinkedIn", () => {
    expect(links(sections[1])).toMatchObject({
      'andreschardong.com': 'https://andreschardong.com/',
      GitHub: 'https://github.com/andreschardong',
      LinkedIn: 'https://www.linkedin.com/in/andreschardong',
    });
  });

  it('says nothing about the data release', () => {
    expect(sections.map(text).join(' ')).not.toContain('release 3.40');
  });

  it('opens every external link safely', () => {
    for (const section of sections) {
      for (const anchor of section.querySelectorAll('a')) expect(anchor.rel).toContain('noopener');
    }
  });
});
