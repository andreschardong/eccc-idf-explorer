// Addresses of ECCC's own files for a station. Pure functions: no DOM and no network.

export type PlotId = 'graph' | 'qq' | 'return' | 'trend';

export interface PlotFile {
  id: PlotId;
  title: string;
  /** Label for the plot selector. */
  short: string;
  description: string;
  pdf: string;
  png: string;
  pdfName: string;
  pngName: string;
}

/** One file on the host, with the name ECCC gave it. */
export interface OfficialFile {
  name: string;
  url: string;
}

export interface OfficialFiles {
  /** The station's text file, the one this site's numbers are read from. */
  text: string;
  /** The text file's name as ECCC published it. */
  textName: string;
  plots: PlotFile[];
  /** Every file of the station: the text file, then the PDF and PNG of each plot (nine in all). */
  all: OfficialFile[];
  /** The host's landing page, which lists the whole release. */
  index: string;
}

const PLOTS: readonly { id: PlotId; suffix: string; title: string; short: string; description: string }[] = [
  {
    id: 'graph',
    suffix: '',
    title: 'IDF graph',
    short: 'IDF graph',
    description: 'The official intensity-duration-frequency curves, 5 minutes to 24 hours, for each return period.',
  },
  {
    id: 'qq',
    suffix: '_qq',
    title: 'Quantile-quantile plot',
    short: 'Q–Q plot',
    description: 'Checks the Gumbel fit: each annual maximum against the value the fitted distribution predicts for it. Points close to the red line fit well.',
  },
  {
    id: 'return',
    suffix: '_r',
    title: 'Return-level plot',
    short: 'Return levels',
    description: 'Rainfall depth against return period for each duration, with the Gumbel estimate, the 95 % confidence limits and the annual maxima.',
  },
  {
    id: 'trend',
    suffix: '_t',
    title: 'Trend plot',
    short: 'Trend',
    description: "Each annual maximum through time, with ECCC's trend result and slope.",
  },
];

/**
 * Builds the addresses of a station's files on the host.
 * @param base Host address, with or without a trailing slash.
 * @param release Release number, e.g. "3.40".
 * @param id Climate ID, e.g. "8300301".
 * @param stem ECCC's file name without extension.
 */
export function officialFiles(base: string, release: string, id: string, stem: string): OfficialFiles {
  const root = base.replace(/\/+$/, '');
  const url = (name: string): string => `${root}/v${release}/stations/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
  const plots = PLOTS.map((plot) => ({
    id: plot.id,
    title: plot.title,
    short: plot.short,
    description: plot.description,
    pdf: url(`${stem}${plot.suffix}.pdf`),
    png: url(`${stem}${plot.suffix}.png`),
    pdfName: `${stem}${plot.suffix}.pdf`,
    pngName: `${stem}${plot.suffix}.png`,
  }));
  const all: OfficialFile[] = [
    { name: `${stem}.txt`, url: url(`${stem}.txt`) },
    ...plots.flatMap((plot) => [{ name: plot.pdfName, url: plot.pdf }, { name: plot.pngName, url: plot.png }]),
  ];
  return {
    text: url(`${stem}.txt`),
    textName: `${stem}.txt`,
    plots,
    all,
    index: `${root}/`,
  };
}

/** Name of the ZIP offered for "download all": eccc-idf-v3.40-8300301-official-files.zip */
export function zipFileName(release: string, id: string): string {
  return `eccc-idf-v${release}-${id}-official-files.zip`;
}
