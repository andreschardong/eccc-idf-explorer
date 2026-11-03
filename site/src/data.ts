// Loads the static JSON that `eccc-idf build-site-data` writes into site/public/data.
import type { DatasetInfo, StationDetail, StationSummary } from './types';

const base = new URL('data/', document.baseURI);

async function getJson<T>(relativePath: string): Promise<T> {
  const response = await fetch(new URL(relativePath, base));
  if (!response.ok) {
    throw new Error(`Could not load ${relativePath} (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

export const loadDataset = (): Promise<DatasetInfo> => getJson<DatasetInfo>('dataset.json');
export const loadIndex = (): Promise<StationSummary[]> => getJson<StationSummary[]>('stations.json');

const stationCache = new Map<string, Promise<StationDetail>>();

/** Full detail for one station; each file is fetched once. */
export function loadStation(id: string): Promise<StationDetail> {
  let request = stationCache.get(id);
  if (!request) {
    request = getJson<StationDetail>(`stations/${encodeURIComponent(id)}.json`).catch((error: unknown) => {
      stationCache.delete(id);
      throw error;
    });
    stationCache.set(id, request);
  }
  return request;
}

export function stationJsonUrl(id: string): string {
  return new URL(`stations/${encodeURIComponent(id)}.json`, base).href;
}
