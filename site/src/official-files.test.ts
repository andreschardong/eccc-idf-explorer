import { describe, expect, it } from 'vitest';
import { officialFiles, zipFileName } from './official-files';

const BASE = 'https://files.example.test';
const STEM = 'idf_v3-40_2025_12_5_830_PE_8300301_CHARLOTTETOWN_A';
const files = officialFiles(BASE, '3.40', '8300301', STEM);
const folder = `${BASE}/v3.40/stations/8300301/`;

describe('officialFiles', () => {
  it("puts every file under the release and the climate ID, with ECCC's own names", () => {
    expect(files.text).toBe(`${folder}${STEM}.txt`);
    expect(files.textName).toBe(`${STEM}.txt`);
    expect(files.plots.map((plot) => plot.pdf.replace(folder, ''))).toEqual([
      `${STEM}.pdf`, `${STEM}_qq.pdf`, `${STEM}_r.pdf`, `${STEM}_t.pdf`,
    ]);
    expect(files.plots.map((plot) => plot.png.replace(folder, ''))).toEqual([
      `${STEM}.png`, `${STEM}_qq.png`, `${STEM}_r.png`, `${STEM}_t.png`,
    ]);
  });

  it('lists all nine files of the station: the text file, then the PDF and PNG of each plot', () => {
    expect(files.all).toHaveLength(9);
    expect(files.all.map((file) => file.name)).toEqual([
      `${STEM}.txt`,
      `${STEM}.pdf`, `${STEM}.png`,
      `${STEM}_qq.pdf`, `${STEM}_qq.png`,
      `${STEM}_r.pdf`, `${STEM}_r.png`,
      `${STEM}_t.pdf`, `${STEM}_t.png`,
    ]);
    expect(files.all.every((file) => file.url === `${folder}${encodeURIComponent(file.name)}`)).toBe(true);
  });

  it('names each plot, in full and for the selector, with a plain-language description', () => {
    expect(files.plots.map((plot) => plot.title)).toEqual(['IDF graph', 'Quantile-quantile plot', 'Return-level plot', 'Trend plot']);
    expect(files.plots.map((plot) => plot.short)).toEqual(['IDF graph', 'Q–Q plot', 'Return levels', 'Trend']);
    expect(files.plots.every((plot) => plot.description.length > 40)).toBe(true);
  });

  it('keeps ECCC file names that carry a plot name in the file name pair', () => {
    for (const plot of files.plots) {
      expect(plot.pdfName.replace('.pdf', '')).toBe(plot.pngName.replace('.png', ''));
    }
  });

  it('ignores a trailing slash on the host and points the index at its root', () => {
    expect(officialFiles(`${BASE}/`, '3.40', '8300301', STEM).text).toBe(files.text);
    expect(files.index).toBe(`${BASE}/`);
  });

  it('escapes characters that are not safe in an address, but keeps the real name', () => {
    const odd = officialFiles(BASE, '3.40', '8300301', 'idf_v3-40_x_(AUT) A&B');
    expect(odd.text).toContain('idf_v3-40_x_(AUT)%20A%26B.txt');
    expect(odd.textName).toBe('idf_v3-40_x_(AUT) A&B.txt');
  });
});

describe('zipFileName', () => {
  it('carries the release and climate ID', () => {
    expect(zipFileName('3.40', '8300301')).toBe('eccc-idf-v3.40-8300301-official-files.zip');
  });
});
