#!/usr/bin/env node
// Regenerates site/public/data from an ECCC IDF release with the .NET tool.
//
//   node scripts/update-data.mjs [url-or-local-zip]
//
// The default is release 3.40. When ECCC publishes a new release, pass its zip URL.
// The 665 MB download goes into data-source/, which git ignores.
import { DEFAULT_URL, ensureBundle, runCli } from './lib.mjs';

const zip = await ensureBundle(process.argv[2] ?? DEFAULT_URL);
runCli('build-site-data', zip, 'site/public/data');
