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
the "About the data" dialog. No API key or account is used, and no data about visitors is sent
anywhere by this project.

## Build and test tooling

Vite, Vitest and TypeScript (MIT / Apache-2.0), xUnit v3 (Apache-2.0), NSubstitute (BSD-3-Clause)
and Shouldly (BSD-3-Clause) are used at build and test time only and are not shipped.
