// Addresses of ECCC's own files for a station. Pure functions: no DOM and no network.

export type PlotId = 'graph' | 'qq' | 'return' | 'trend';

export interface PlotFile {
  id: PlotId;
  title: string;
  description: string;
  pdf: string;
  png: string;
}

export interface OfficialFiles {
  /** The station's text file, the one this site's numbers are read from. */
  text: string;
  plots: PlotFile[];
  /** The host's landing page, which lists the whole release. */
  index: string;
}

const PLOTS: readonly { id: PlotId; suffix: string; title: string; description: string }[] = [
  {
    id: 'graph',
    suffix: '',
    title: 'IDF graph',
    description: 'The official intensity-duration-frequency curves, 5 minutes to 24 hours, for each return period.',
  },
  {
    id: 'qq',
    suffix: '_qq',
    title: 'Quantile-quantile plot',
    description: 'Checks the Gumbel fit: each annual maximum against the value the fitted distribution predicts for it. Points close to the red line fit well.',
  },
  {
    id: 'return',
    suffix: '_r',
    title: 'Return-level plot',
    description: 'Rainfall depth against return period for each duration, with the Gumbel estimate, the 95 % confidence limits and the annual maxima.',
  },
  {
    id: 'trend',
    suffix: '_t',
    title: 'Trend plot',
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
  return {
    text: url(`${stem}.txt`),
    plots: PLOTS.map((plot) => ({
      id: plot.id,
      title: plot.title,
      description: plot.description,
      pdf: url(`${stem}${plot.suffix}.pdf`),
      png: url(`${stem}${plot.suffix}.png`),
    })),
    index: `${root}/`,
  };
}
