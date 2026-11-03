#!/usr/bin/env node
// Downloads an ECCC IDF release and regenerates site/public/data with the .NET tool.
//
//   node scripts/update-data.mjs [url-or-local-zip]
//
// The default is release 3.40. When ECCC publishes a new release, pass its zip URL.
// The 665 MB download goes into data-source/, which git ignores.
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_URL = 'https://collaboration.cmc.ec.gc.ca/cmc/climate/Engineer_Climate/IDF/idf_v3-40_2025-12-5.zip';
const source = process.argv[2] ?? DEFAULT_URL;

async function download(url) {
  const directory = join(root, 'data-source');
  mkdirSync(directory, { recursive: true });
  const target = join(directory, basename(new URL(url).pathname));
  if (existsSync(target)) {
    console.log(`Using the existing download ${target}`);
    return target;
  }
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return target;
}

const zip = /^https?:\/\//i.test(source) ? await download(source) : resolve(source);
const result = spawnSync(
  'dotnet',
  ['run', '--project', 'src/EcccDataExplorer.Cli', '--configuration', 'Release', '--', 'build-site-data', zip, 'site/public/data'],
  { cwd: root, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
