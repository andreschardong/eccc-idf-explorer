#!/usr/bin/env node
// Unpacks ECCC's own PDF, PNG and text files and publishes them on Cloudflare Pages, outside git.
//
//   node scripts/publish-official-files.mjs [url-or-local-zip] [--name eccc-idf-files] [--no-deploy]
//
// 1. Unpacks every file of the release, unchanged, into official-files/ (git ignores it).
// 2. Adds a landing page and cache headers.
// 3. Deploys the folder as a Cloudflare Worker's static assets with Wrangler (log in first: wrangler login).
//
// A deployment is a snapshot of the whole folder, so keep official-files/ between releases:
// unpacking release 3.41 next to v3.40 publishes both.
import { spawnSync } from 'node:child_process';
import {
  existsSync, readdirSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_URL, ensureBundle, root, runCli,
} from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const name = option('--name', 'eccc-idf-files');
const positional = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--name');

const output = join(root, 'official-files');
const zip = await ensureBundle(positional[0] ?? DEFAULT_URL);
runCli('extract-official-files', zip, 'official-files');

const releases = readdirSync(output, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^v\d/.test(entry.name))
  .map((entry) => entry.name)
  .sort()
  .reverse();

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[c]);

const releaseSections = releases.map((release) => {
  const folder = join(output, release, 'release');
  const files = existsSync(folder) ? readdirSync(folder).sort() : [];
  const stations = readdirSync(join(output, release, 'stations')).length;
  return `<section>
  <h2>Release ${escapeHtml(release.slice(1))}</h2>
  <p>${stations} stations. Each folder <code>${release}/stations/&lt;climate ID&gt;/</code> holds the station's text file, its
  IDF graph, its Gumbel quantile-quantile plot (<code>_qq</code>), its return-level plot (<code>_r</code>) and its trend plot
  (<code>_t</code>), as PDF and PNG, under ECCC's own file names.</p>
  <p>Release notes and tables:</p>
  <ul>${files.map((f) => `<li><a href="${release}/release/${encodeURIComponent(f)}">${escapeHtml(f)}</a></li>`).join('')}</ul>
</section>`;
}).join('\n');

writeFileSync(join(output, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ECCC rainfall IDF files</title>
<meta name="color-scheme" content="light dark">
<style>
  :root { color-scheme: light dark; font: 16px/1.55 system-ui, sans-serif; }
  body { max-width: 44rem; margin: 3rem auto; padding: 0 1rem; }
  h1 { font-size: 1.6rem; letter-spacing: -0.02em; }
  h2 { margin-top: 2rem; font-size: 1.2rem; }
  code { font-size: 0.9em; }
  a { color: #1c5cab; }
  @media (prefers-color-scheme: dark) { a { color: #86b6ef; } }
</style>
</head>
<body>
<h1>ECCC rainfall IDF files</h1>
<p>A mirror of the files in Environment and Climate Change Canada's short-duration rainfall
intensity-duration-frequency (IDF) releases, unpacked so each station's graphs and text file have their own address.
The files are unchanged. The <a href="https://andreschardong.github.io/eccc-idf-explorer/">IDF Explorer</a> links here.</p>
<p>Contains information licensed under the
<a href="https://open.canada.ca/en/open-government-licence-canada">Open Government Licence – Canada</a>.
This mirror is independent and is not affiliated with or endorsed by ECCC. The official source is the
<a href="https://climate.weather.gc.ca/prods_servs/engineering_e.html">Engineering Climate Datasets</a> page.</p>
${releaseSections}
</body>
</html>
`);

writeFileSync(join(output, '_headers'), `/
  Cache-Control: public, max-age=300

/v*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *
  X-Content-Type-Options: nosniff
`);

console.log(`Prepared ${output} for ${releases.join(', ')}.`);
if (flag('--no-deploy')) process.exit(0);

// Cloudflare has folded Pages into Workers, so the files are served as a Worker's static assets.
const deploy = spawnSync(
  'npx',
  ['--yes', 'wrangler@4', 'deploy', '--config', 'scripts/official-files/wrangler.jsonc', '--name', name],
  { cwd: root, stdio: 'inherit', shell: true },
);
process.exit(deploy.status ?? 1);
