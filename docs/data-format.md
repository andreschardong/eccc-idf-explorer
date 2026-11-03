# ECCC IDF release 3.40: file format and parsing notes

These notes describe what is in the ECCC download and what the parser in
`src/EcccDataExplorer.Idf` does about its quirks. They come from reading all 751 station files
of release 3.40 (processed 2025-12-05), not from a specification: ECCC does not publish one.

## The download

`idf_v3-40_2025-12-5.zip` (about 665 MB) holds:

```
idf_v3-40_2025-12-5/
  whats_new_IDF_v3-40.pdf            release notes, English
  quoi_de_neuf_IDF_v3-40.pdf         release notes, French
  idf_v-3.40_2025_12_5_log_included.xlsx   station list and change log against v3.30
  IDF_Files_Fichiers/
    AB.zip BC.zip ... YT.zip         14 zips of station files (.txt, .pdf, .png each)
    IDF_Additional_Additionnel_v3-40.zip   flat all-station tables (see below)
```

The release notes give 751 stations: 357 unchanged, 37 new, 312 updated and 45 joined with an
existing station, with observations through 2024. The 200-year return period is now provided for
Newfoundland and Labrador as well.

The regional zips are **not** a reliable index of province. `PE.zip`, for example, also holds
Pelly Ranch (Yukon) and Pentecôte (Quebec). Always read the province from the station file.

## Station files

One text file per station, Latin-1 encoded, named
`idf_v3-40_2025_12_5_<climate district>_<province>_<climate ID>_<NAME>.txt`. Each carries:

| Part | Content |
|---|---|
| Header | Fitting method, processing date, name, province, climate ID, `(composite)` flag, latitude and longitude to the minute, elevation, years of data |
| Table 1 | Annual maximum rainfall depth (mm) per year and duration, then sample size, mean, standard deviation, skewness and kurtosis per duration |
| Table 2a | Return-period rainfall depth (mm): 9 durations × 7 return periods, plus years of data per duration |
| Table 2b | Return-period rainfall rate (mm/h), each followed by a `+/-` row with the half-width of the 95 % confidence interval |
| Table 3 | The interpolation fit `R = A · T^B` (R in mm/h, T in hours) per return period, with its mean, standard deviation, standard error and mean percent error |

Durations are 5, 10, 15, 30 min and 1, 2, 6, 12, 24 h. Return periods are 2, 5, 10, 25, 50, 100
and 200 years. The parser reads both lists from the file rather than assuming them.

## Quirks the parser handles

| Quirk | What the file does | What the parser does |
|---|---|---|
| Missing values | `-99.9` | `null` |
| Durations not analysed | 65 stations print `-99.9` rows with 0 years of data in Tables 2a and 2b, and `+/--99.9` in the confidence rows | `null` cells and `0` in the sample years; the site shades the range as "Not analysed" |
| Overflow stars | Skewness or kurtosis too wide for its 7-character field prints a run of `*`, covering one column per 7 stars (`Skew.*******   -NaN ...`) | One `null` per 7 stars |
| `NaN` | `-NaN` in skewness cells | `null` |
| Warning block | In 420 files, a "Warning: annual maximum amount greater than 100-yr return period amount" block sits inside Table 1 and its lines also start with a year | Year rows are read only down to the dashed separator, so the warning is never mistaken for data |
| Whole-minute coordinates | `46 17'N` | Decimal degrees, rounded to 4 places; the real precision is about 1.8 km |
| Latest year | Station 7027470 (Saint-Germain-de-Grantham, QC) carries 2025 data although the notes say observations end in 2024 | Reported as is; the site says "latest year of data in any station file" |

A format surprise raises `IdfFormatException` naming the file and what was expected, so a new
release that changes the layout fails loudly instead of producing wrong numbers.

## The flat all-station tables

`IDF_Additional_Additionnel_v3-40.zip` holds comma-separated tables with every station on one row
and two decimals (the station files print one):

`return_period_amounts`, `return_period_rates`, `return_period_conf_interval`, `log_included`
(station list with decimal coordinates, record span and fit), `log_excluded` (stations dropped for
a record shorter than 10 years), `trends`, and a legacy `idfm0019.txt`.

The first four are used as an independent check. `eccc-idf verify` and `build-site-data` compare
every number parsed from a station file with the same number here, allowing for the one-decimal
rounding (a difference of at most 0.05). For release 3.40 that is **751 stations and 147,947 values
in agreement**. The log's name column is 40 characters wide and cuts longer names off; the check
accounts for that.

## What `build-site-data` writes

```
site/public/data/
  dataset.json         release, processing date, latest year, station count, licence
  stations.json        one summary row per station (map and search)
  stations/{id}.json   one file per station with every table
```

Output is ordered by climate ID and has no timestamps, so regenerating from the same release gives
identical bytes. The contract is typed in `site/src/types.ts` and written by
`src/EcccDataExplorer.Idf/SiteData`. Null properties are omitted; a missing cell inside a matrix
is `null`.

## Using these numbers

ECCC publishes guidance on using IDF curves (*Best Practices for Using IDF Curves*, in the
`Documentation_and_Guidance` folder next to the download). It covers the limits of a short record,
extrapolation beyond the record length and climate change. Read it before using any value for
design.
