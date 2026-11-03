// Shared helpers for the maintenance scripts in this folder.
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** ECCC release 3.40. Pass a newer URL, or a local zip, when ECCC publishes a new release. */
export const DEFAULT_URL = 'https://collaboration.cmc.ec.gc.ca/cmc/climate/Engineer_Climate/IDF/idf_v3-40_2025-12-5.zip';

/**
 * Returns a local path to the ECCC bundle. A URL is downloaded once into data-source/ (git ignores it,
 * and it is reused on later runs so ECCC's server is not hit again); a local path is used as given.
 */
export async function ensureBundle(source = DEFAULT_URL) {
  if (!/^https?:\/\//i.test(source)) return resolve(source);
  const directory = join(root, 'data-source');
  mkdirSync(directory, { recursive: true });
  const target = join(directory, basename(new URL(source).pathname));
  if (existsSync(target)) {
    console.log(`Using the existing download ${target}`);
    return target;
  }
  console.log(`Downloading ${source}`);
  const response = await fetch(source);
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return target;
}

/** Runs the eccc-idf tool; exits the process with its status if it fails. */
export function runCli(...args) {
  const result = spawnSync(
    'dotnet',
    ['run', '--project', 'src/EcccDataExplorer.Cli', '--configuration', 'Release', '--', ...args],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
