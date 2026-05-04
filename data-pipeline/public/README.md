# Public Data Pipeline (Experimental)

> **Status:** Experimental alternative pipeline. **Not** used by the
> deployed web map. The production site is built from the GDB-based
> pipeline in [`../scripts/`](../scripts/).

This directory contains a parallel data pipeline that reproduces the
visualization using **only publicly downloadable data** from
[PASDA](https://www.pasda.psu.edu/) (the Pennsylvania Spatial Data
Access repository). It was built so the methodology could, in theory,
be reproduced end-to-end by anyone without needing the precomputed
Tree Pittsburgh / WPC GeoDatabase.

## Why It Exists (and Why It's Not the Default)

The default pipeline in [`../scripts/`](../scripts/) reads
`TreeCanopyChange_2015_2020_AlleghenyCounty.gdb`, a GeoDatabase
produced by the UVM Spatial Analysis Lab for Tree Pittsburgh / WPC.
That GDB is the **authoritative, most carefully analyzed version**
of the 2015→2020 canopy change data — it applied additional
refinement (removing internal clearings, meadows, and paths within
forested areas) on top of the raw PASDA footprints.

When this experimental pipeline was first built, the GDB was not
publicly downloadable. The goal was to provide a fully reproducible
open-source alternative. However, reproducing the change
classification from PASDA's raw 2010–2015 and 2020 footprints
yields a **~4.1% larger 2015 canopy estimate** than the refined GDB
— roughly 10,000 acres of difference across Allegheny County — and
correspondingly different gain / loss / net-change numbers.

See [`discrepancy-report/`](discrepancy-report/) for a detailed
side-by-side comparison with 11 annotated examples.

**We have confirmed with the data provider that the GDB version is
the latest and most accurate analysis,** so the production site uses
the GDB pipeline. Efforts are underway to have the refined GDB
uploaded to PASDA as a public download; if/when that happens, this
public pipeline can be updated to consume it and the two pipelines
should converge.

## When Would You Use This Pipeline?

- **Reproducing the analysis from scratch** without access to the
  Tree Pittsburgh GDB
- **Comparing** PASDA raw footprints against the refined GDB (e.g.,
  if you want to audit the refinement or investigate the
  discrepancy further)
- **Extending** the analysis to time periods not covered by the GDB
  (the PASDA 2010–2015 dataset is available here, enabling a
  2010→2015→2020 trend visualization in the future)
- **Previewing** what the map would look like with a future refined
  2015 baseline, if one is published to PASDA

For day-to-day development of the production site, use the default
[`../scripts/`](../scripts/) pipeline instead.

## Using the Public Pipeline Output in the Web App

The web app can load this pipeline's output instead of the default
GDB output via a URL parameter:

```
https://<your-site>/?source=public
```

This is an **undocumented toggle** — it is intentionally not exposed
in the UI because the public pipeline is experimental. When active,
a blue **"Public Pipeline Data"** banner appears at the top of the
page so you know you're not looking at production data.

Implementation: [`web-app/src/config/dataSource.js`](../../web-app/src/config/dataSource.js)
reads `?source=public` from the query string and switches
`DATA_PREFIX` from `data` to `data-public`. All layer URLs in
[`web-app/src/config/layers.js`](../../web-app/src/config/layers.js)
are built from that prefix, so a single parameter flips every data
fetch over to the public-pipeline output.

For local development, create both symlinks:

```bash
cd web-app
ln -sf ../../data-pipeline/output        public/data         # default (GDB)
ln -sf ../../data-pipeline/output_public public/data-public  # experimental
```

## Scripts

All scripts read configuration from [`config.py`](config.py) and
write into `data-pipeline/output_public/`. Run in numerical order.

| # | Script | Purpose |
|---|--------|---------|
| 00 | `00_download.py` | Download all PASDA ZIPs + Allegheny County hydrology |
| 01 | `01_derive_canopy_change.py` | Derive 2015→2020 change from 2015 and 2020 footprint overlay |
| 02 | `02_extract_boundaries.py` | Normalize boundary shapefiles; subtract water from land area |
| 03 | `03_compute_boundary_stats.py` | Spatial overlay: canopy × boundaries (SLOW — up to ~6 hrs county-wide) |
| 04 | `04_extract_mature_trees.py` | Filter loss/gain to ≥ 0.04 acre polygons |
| 05 | `05_generate_pmtiles.py` | GeoJSON → PMTiles via tippecanoe |
| 06 | `06_street_buffer.py` | Buffer Allegheny County streets 50 ft |
| 07 | `07_street_canopy_stats.py` | Per-street and per-boundary street canopy stats |
| 08 | `08_tag_street_buffer.py` | Tag trees with `in_street_buffer`; regenerate PMTiles |
| 09 | `09_full_canopy_change.py` | All canopy → PMTiles (~1.1 GB) |
| 10 | `10_compute_boundary_exemplar_losses.py` | Bake an exemplar loss silhouette + centroid into each boundary feature (drives the popup CTA in the web app). Reads `data-pipeline/config/exemplar_overrides.yaml` — see [`../README.md`](../README.md#08_compute_boundary_exemplar_lossespy) for full schema docs. |

## Data Model Differences

Unlike the GDB (which ships pre-classified change polygons with a
`Change` field of 1/2/3 for no_change/gain/loss), PASDA distributes
separate canopy **footprints** for different years. This pipeline
derives the change classification by spatial overlay:

- **2015 footprint** = `Change ∈ {1, 2}` from the 2010–2015 dataset
  (no_change + gain)
- **2020 footprint** = all polygons from the 2015–2020 dataset
  (the `Change` field on the 2015–2020 export is broken — constant
  value — so we treat it as a raw footprint)
- **Loss (2015→2020)** = `2015 ∖ 2020`
- **Gain (2015→2020)** = `2020 ∖ 2015`
- **No change** = `2015 ∩ 2020`

> **Note:** Only the `__2020` historic export of the 2010–2015
> dataset on PASDA has a valid `Change` field. Newer exports
> (202301, 202507, …) have `Change` set to a constant — this
> pipeline uses the `__2020` version specifically for that reason.
> See comments at the top of [`config.py`](config.py) for details.

## Known Discrepancy vs GDB

| Metric | PASDA-derived (this pipeline) | Refined GDB (default) | Diff |
|--------|-------------------------------|-----------------------|------|
| 2015 canopy, Allegheny County | 255,110 acres | 245,141 acres | +4.1% |
| 2020 canopy, Allegheny County | matches GDB to < 1 acre | — | ~0% |

The 2020 footprints match nearly exactly. The 2015 difference is
the UVM refinement: tighter polygon boundaries that exclude internal
clearings, meadows, and footpaths within tree-covered areas.

See [`discrepancy-report/canopy_discrepancy_report.html`](discrepancy-report/canopy_discrepancy_report.html)
and the 11 annotated example maps in
[`discrepancy-report/discrepancy_maps/`](discrepancy-report/discrepancy_maps/)
for side-by-side visuals.

## Relationship to the GDB Pipeline

| | Default GDB pipeline | Public pipeline (this dir) |
|---|---|---|
| Source data | `source-gis-data/*.gdb` (not committed) | PASDA downloads (fetched by `00_download.py`) |
| Scripts | [`../scripts/`](../scripts/) | this directory |
| Output | `data-pipeline/output/` | `data-pipeline/output_public/` |
| Web symlink | `web-app/public/data` | `web-app/public/data-public` |
| Web URL | default | `?source=public` |
| Canopy change source | pre-classified in GDB | derived by spatial overlay |
| Accuracy vs UVM analysis | authoritative | +4.1% over-estimate on 2015 baseline |
| Reproducibility | requires GDB from SHUC | fully public, anyone can run |
| Used in production | **yes** | no |
