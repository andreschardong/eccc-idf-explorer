// Saving files to the visitor's computer, from this page or from the ECCC files host.
//
// A plain link with a `download` attribute is ignored for another site's files, so the bytes are fetched here
// (the files host allows it with CORS) and saved from memory, which keeps ECCC's own file name.
import { zipSync, type Zippable } from 'fflate';
import type { OfficialFile } from './official-files';

export type Fetcher = (url: string) => Promise<Response>;

const defaultFetcher: Fetcher = (url) => fetch(url);

/** Offers a blob as a file download under the given name. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The bytes of a file. Throws with the HTTP status when the host does not have it. */
export async function fetchBytes(url: string, fetcher: Fetcher = defaultFetcher): Promise<Uint8Array> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Downloads one file under its own name. */
export async function downloadFile(file: OfficialFile, fetcher: Fetcher = defaultFetcher): Promise<number> {
  const bytes = await fetchBytes(file.url, fetcher);
  saveBlob(new Blob([bytes as BlobPart]), file.name);
  return bytes.byteLength;
}

/**
 * Downloads several files as one ZIP. The PDFs and PNGs are already compressed, so the archive stores them as they
 * are. Returns the size of the ZIP. If any file is missing nothing is saved and the error names it.
 */
export async function downloadZip(files: readonly OfficialFile[], zipName: string, fetcher: Fetcher = defaultFetcher): Promise<number> {
  const entries = await Promise.all(files.map(async (file) => {
    try {
      return [file.name, await fetchBytes(file.url, fetcher)] as const;
    } catch (error) {
      throw new Error(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  const archive: Zippable = {};
  for (const [name, bytes] of entries) archive[name] = [bytes, { level: 0 }];
  const zip = zipSync(archive);
  saveBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), zipName);
  return zip.byteLength;
}

/**
 * ECCC's text files are Latin-1 (the accents in "Données" are single bytes), and the host sends no character set,
 * so they are decoded here rather than left to the browser.
 */
export function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder('windows-1252').decode(bytes);
}

/** 1536 -> "1.5 kB", 2500000 -> "2.5 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
