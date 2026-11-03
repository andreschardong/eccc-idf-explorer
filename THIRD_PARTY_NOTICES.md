# Third-party notices

The MIT licence in `LICENSE` covers the source code in this repository. The data and the
components below keep their own terms.

## Data: Environment and Climate Change Canada

The IDF data in `site/public/data/` and the station files in
`tests/EcccDataExplorer.Idf.Tests/Fixtures/` are derived from the *Engineering Climate Datasets*
published by Environment and Climate Change Canada (ECCC), IDF release 3.40, processed 2025-12-05.

> Contains information licensed under the
> [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

Source: <https://climate.weather.gc.ca/prods_servs/engineering_e.html>

This project is independent. It is not affiliated with, or endorsed by, ECCC or the Government of
Canada. The data has been reformatted (text tables to JSON); its values are unchanged, and every
value is cross-checked against ECCC's own flat tables when the data is built.

## Runtime dependencies of the web site

| Component | Licence | Use |
|---|---|---|
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | BSD-3-Clause | Map rendering |
| [Atkinson Hyperlegible Next](https://fontsource.org/fonts/atkinson-hyperlegible-next) (via Fontsource) | SIL Open Font License 1.1 | Typeface, self-hosted in the build |

## Base map

The base map is served by [OpenFreeMap](https://openfreemap.org) from
[OpenMapTiles](https://www.openmaptiles.org/) schema data © OpenStreetMap contributors
([ODbL](https://www.openstreetmap.org/copyright)). The attribution is shown on the map and in
the About dialog. No API key or account is used.

## What visitors' browsers contact

The site is static and has no server of its own, no analytics, no cookies and no sign-in. A visitor's browser does
make requests to two other hosts, which see the visitor's IP address as any web server does:

- **OpenFreeMap** (`tiles.openfreemap.org`) for map tiles and map fonts.
- **Cloudflare** (`eccc-idf-files.andreschardong.workers.dev`) for ECCC's own PDF, PNG and text files, when the
  Files tab is opened or a file is downloaded. The site itself is also served by Cloudflare.

The only thing the site stores in the browser is the chosen colour theme (`localStorage`), and only after the
theme button is used.

## ECCC's own files, mirrored

The files on the Cloudflare host are ECCC's PDF, PNG and text files for release 3.40, byte for byte as published.
The PDFs and PNGs carry ECCC and Government of Canada marks because they are ECCC's documents; they are reproduced
unchanged and do not imply that this project is endorsed by ECCC or the Government of Canada.

## Build and test tooling

Vite, Vitest, happy-dom, Playwright and TypeScript (MIT / Apache-2.0), axe-core (MPL-2.0), xUnit v3 (Apache-2.0),
NSubstitute (BSD-3-Clause) and Shouldly (BSD-3-Clause) are used at build and test time only and are not shipped.
