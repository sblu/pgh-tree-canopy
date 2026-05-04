# Data Pipeline

Python scripts that process Allegheny County GIS data into GeoJSON and
PMTiles files for the Pittsburgh Tree Canopy web visualization.

This is the **default pipeline** used to build the deployed site. It
reads the pre-classified `TreeCanopyChange_2015_2020_AlleghenyCounty.gdb`
produced by the UVM Spatial Analysis Lab for Tree Pittsburgh / WPC —
the authoritative, most carefully analyzed version of the 2015→2020
canopy change data.

> **Alternative pipeline:** [`public/`](public/) contains an
> experimental parallel pipeline that reproduces the analysis from
> publicly downloadable PASDA data. It is **not** used in production
> (it yields a ~4.1% larger 2015 canopy estimate than the refined GDB).
> See [`public/README.md`](public/README.md) for when you'd use it and
> how to preview its output in the web app via `?source=public`.

## Setup

**System dependency** (install once with sudo):
```bash
sudo apt-get install tippecanoe
```

**Python dependencies:**
```bash
pip install -r requirements.txt
```

**Dependencies** (pinned in `requirements.txt`):
| Package | Version | Purpose |
|---------|---------|---------|
| geopandas | 1.0.1 | GeoDataFrame operations and GeoJSON export |
| pyogrio | 0.11.1 | Fast GDAL-backed I/O for reading `.gdb` files |
| shapely | 2.0.7 | Geometry operations (buffering, intersection) |
| pyproj | 3.6.1 | Coordinate reference system transformations |
| PyYAML | 6.0.2 | Reads `config/exemplar_overrides.yaml` (script 08) |

**System tools used:**
| Tool | Version | Purpose |
|------|---------|---------|
| tippecanoe | 2.49+ | Converts GeoJSON → PMTiles vector tile archives |
| GDAL / ogrinfo | 3.8+ | Available for manual GDB inspection |

## Source Data

Place the source GDB files at:
```
source-gis-data/TreeCanopyChange_2015_2020_AlleghenyCounty.gdb
source-gis-data/PittsburghRoads/p20/context.gdb
```

These files are not committed to the repository due to size. Contact the
Squirrel Hill Urban Coalition for access.

## Scripts

Run scripts in numerical order. Each script writes output files that can be
opened directly in QGIS for visual inspection.

### `01_extract_boundary_layers.py`

Extracts administrative boundary polygons with pre-computed canopy statistics
from the Allegheny County GDB. Computes two loss metrics per feature.

```bash
python3 scripts/01_extract_boundary_layers.py
```

**Output** → `output/boundary_layers/`
| File | Features | Description |
|------|----------|-------------|
| `neighborhoods.geojson` | 90 | Pittsburgh neighborhoods |
| `parks_municipal.geojson` | 215 | Pittsburgh city parks |
| `parks_county.geojson` | 9 | Allegheny County regional parks |
| `city_council_districts.geojson` | 9 | Pittsburgh City Council districts |
| `county_council_districts.geojson` | 13 | Allegheny County Council districts |
| `municipalities.geojson` | 130 | Allegheny County municipalities |

**Output schema per feature:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the area |
| `land_area_acres` | float | Total land area (excludes water bodies) |
| `canopy_2015_acres` | float | Tree canopy coverage in 2015 |
| `canopy_2020_acres` | float | Tree canopy coverage in 2020 |
| `gain_acres` | float | Canopy area gained 2015–2020 |
| `loss_acres` | float | Canopy area lost 2015–2020 |
| `no_change_acres` | float | Canopy area unchanged 2015–2020 |
| `net_pct_of_area` | float | Net change (gain − loss) ÷ land area × 100 |
| `net_pct_of_2015_canopy` | float | Net change ÷ 2015 canopy × 100 |
| `loss_pct_of_area` | float | Loss ÷ land area × 100 |
| `loss_pct_of_2015_canopy` | float | Loss ÷ 2015 canopy × 100 |

After script 05 runs, boundary files are updated with additional
`street_*` columns (see script 05 below).

---

### `02_extract_mature_tree_losses.py`

Filters the 3.3M canopy change polygons to individual tree-scale losses
and gains (≥ 0.04 acres), classified by size. These are displayed as
red/green polygons on the web map at high zoom levels.

```bash
python3 scripts/02_extract_mature_tree_losses.py
```

**Output** → `output/canopy_change/`
| File | Features | Description |
|------|----------|-------------|
| `mature_tree_losses.geojson` | ~99,159 | Loss polygons ≥ 0.04 acres (~174 MB) |
| `mature_tree_gains.geojson` | ~127,000 | Gain polygons ≥ 0.04 acres |

**Output schema per feature (losses):**
| Field | Type | Description |
|-------|------|-------------|
| `loss_acres` | float | Size of the lost canopy area |
| `size_category` | string | `"tree"` (0.04–0.069 ac) or `"grove"` (≥ 0.07 ac) |
| `centroid_lon` | float | WGS84 longitude of polygon centroid |
| `centroid_lat` | float | WGS84 latitude of polygon centroid |

**Output schema per feature (gains):**
| Field | Type | Description |
|-------|------|-------------|
| `gain_acres` | float | Size of the gained canopy area |
| `size_category` | string | `"tree"` (0.04–0.069 ac) or `"grove"` (≥ 0.07 ac) |
| `centroid_lon` | float | WGS84 longitude of polygon centroid |
| `centroid_lat` | float | WGS84 latitude of polygon centroid |

> **Note:** `centroid_lon`/`centroid_lat` are used for Google Street View
> links in the web app popup.

---

### `03_generate_pmtiles.py`

Converts large GeoJSON outputs to PMTiles vector tile archives for efficient
browser rendering. MapLibre GL JS streams only the tiles visible in the
current viewport, so the full 99K-feature dataset renders smoothly.

The source GeoJSON files are preserved alongside the PMTiles — use GeoJSON
for QGIS/desktop inspection and PMTiles for the web map.

```bash
python3 scripts/03_generate_pmtiles.py
```

**Requires:** `tippecanoe` (system install, see Setup above)

**Output** → `output/canopy_change/`
| File | Size | Used by |
|------|------|---------|
| `mature_tree_losses.pmtiles` | ~92 MB | Web map (MapLibre) |
| `mature_tree_gains.pmtiles` | ~105 MB | Web map (MapLibre) |
| `mature_tree_losses.geojson` | ~174 MB | QGIS / desktop GIS |
| `mature_tree_gains.geojson` | ~200 MB | QGIS / desktop GIS |

Tile zoom range: **12–18**. At lower zoom levels tippecanoe progressively
drops the smallest polygons first (individual trees before groves), keeping
high-density areas readable without overflowing tile size limits.

> **Dual-output principle:** Every dataset displayed on the web map also
> exists as a plain GeoJSON or GeoPackage file openable in QGIS. The
> PMTiles file is always generated *from* the GeoJSON, never the reverse.

---

### `04_street_buffer.py`

Reprojects Pittsburgh street centerlines from EPSG:4269 (NAD83) to
EPSG:2272 (PA South State Plane), applies a 50 ft buffer, and exports
the results for use in script 05 and for web display.

```bash
python3 scripts/04_street_buffer.py
```

**Output** → `output/streets/`
| File | Description |
|------|-------------|
| `street_segments_buffered.gpkg` | Buffered street polygons in EPSG:2272 (for script 05 input) |
| `street_centerlines.geojson` | Street centerlines in WGS84 (for web display) |

---

### `05_street_canopy_stats.py`

The most compute-intensive script (~10–30 minutes). Clips the canopy change
polygons to the dissolved street buffer zone and computes per-street and
per-boundary statistics.

Uses `gpd.clip` with a simplified dissolved buffer union (5 ft tolerance)
and processes canopy polygons in 50K-feature chunks with progress reporting.
Per-street and per-boundary attribution uses `gpd.overlay(how="intersection")`
to properly clip canopy pieces at individual street/zone boundaries and
recompute areas from the clipped geometry.

```bash
python3 scripts/05_street_canopy_stats.py
```

**Output** → `output/streets/`
| File | Features | Description |
|------|----------|-------------|
| `street_stats.geojson` | ~5,158 | Per-street centerlines with canopy stats |
| `street_buffer_area.geojson` | 1 (dissolved) | Dissolved 50 ft buffer for web overlay |
| `canopy_in_street_buffer.geojson` | ~152K | Canopy polygons within buffer (QGIS only, ~137 MB) |

**Updates to boundary layer files:**
Script 05 also adds `street_*` columns to all boundary GeoJSON files in
`output/boundary_layers/`, enabling the web app to show street-tree-only
statistics per zone:

| Field | Description |
|-------|-------------|
| `street_no_change_acres` | Unchanged canopy within street buffer |
| `street_gain_acres` | Canopy gained within street buffer |
| `street_loss_acres` | Canopy lost within street buffer |
| `street_canopy_2015_acres` | 2015 canopy within street buffer |
| `street_canopy_2020_acres` | 2020 canopy within street buffer |
| `street_loss_pct_of_area` | Method 1 loss metric (street buffer only) |
| `street_loss_pct_of_2015_canopy` | Method 2 loss metric (street buffer only) |

---

### `06_tag_street_buffer.py`

Adds an `in_street_buffer` boolean property (0 or 1) to each mature tree
loss and gain polygon indicating whether it intersects the dissolved street
buffer area. After tagging, regenerates the PMTiles files so the new
property is available for filtering in the web app.

```bash
python3 scripts/06_tag_street_buffer.py
```

**Updates** → `output/canopy_change/`

Modifies `mature_tree_losses.geojson` and `mature_tree_gains.geojson`
in-place, adding the `in_street_buffer` field, then regenerates
`mature_tree_losses.pmtiles` and `mature_tree_gains.pmtiles`.

---

### `07_full_canopy_change.py`

Extracts the complete TreeCanopyChange layer (3.3M polygons) from the GDB
and converts it to PMTiles for a toggleable canopy change overlay on the
web map. Reports progress at each major step.

```bash
python3 scripts/07_full_canopy_change.py    # ~15–30 min
```

**Output** → `output/canopy_change/`
| File | Size | Description |
|------|------|-------------|
| `canopy_change_all.pmtiles` | ~714 MB | All canopy change polygons (zoom 10–18) |

Each polygon has a `change_class` property: `no_change`, `gain`, or `loss`.

> **Note:** The intermediate GeoJSON (~2.6 GB) is automatically deleted
> after PMTiles generation to save disk space.

---

### `08_compute_boundary_exemplar_losses.py`

For each boundary feature in every layer in `output/boundary_layers/`,
finds an "exemplar" mature loss inside the 50 ft street buffer and bakes
its silhouette + centroid into the boundary's properties. The web app
uses this to show a clickable shape preview at the bottom of every
boundary popup — a discoverability hint that surfaces the before/after
Street View feature.

Selection rule: of the mature losses (≥ 0.04 acres) inside the
boundary's street buffer, pick the **2nd-largest by acreage**, or the
only one if there is just one. Boundaries with no qualifying loss get
`null` for all exemplar fields and the popup hides the CTA. Pinned and
blocklisted exemplars in `config/exemplar_overrides.yaml` (see below)
override the auto-selection.

```bash
python3 scripts/08_compute_boundary_exemplar_losses.py     # ~1–3 min
```

**Inputs:**
- `output/canopy_change/mature_tree_losses.geojson` (from script 02)
- `output/streets/street_segments_buffered.gpkg` (from script 04)
- `output/boundary_layers/*.geojson` (from scripts 01 and 05)
- `data-pipeline/config/exemplar_overrides.yaml` (optional pins/blocklist)

**Output:** updates each `output/boundary_layers/*.geojson` in place with
five new properties per feature:

| Field | Type | Description |
|-------|------|-------------|
| `exemplar_loss_acres` | float \| null | Acreage of the chosen exemplar loss (`null` if none) |
| `exemplar_loss_size_category` | string \| null | `"tree"` or `"grove"` |
| `exemplar_loss_centroid_lon` | float \| null | WGS84 longitude — drives Street View navigation |
| `exemplar_loss_centroid_lat` | float \| null | WGS84 latitude |
| `exemplar_loss_svg_path` | string \| null | Outer-ring polygon normalized to a `100×60` SVG viewBox, ready for inline `<path d="…">` rendering. Aspect-preserving scale, 6 px padding, Y-flipped for SVG. |
| `exemplar_loss_nearest_street` | string \| null | Title-cased name of the nearest centerline within ~200 ft (e.g. `"E Woodland Rd"`). Read from `name`, `FULLNAME`, or `FULL_NAME` — whichever the centerlines file has. |

For MultiPolygon losses, the script keeps only the largest sub-polygon's
outer ring (no holes). The web app renders the path with default
`fill-rule: nonzero`.

#### Exemplar override config

`data-pipeline/config/exemplar_overrides.yaml` is a small, version-
controlled YAML file that lets you (a) blocklist specific losses that
have poor Street View coverage so the pipeline picks the next-largest
candidate instead, or (b) pin a specific loss for a specific boundary.
It is empty by default — the file ships with commented-out examples,
so the pipeline runs cleanly with no overrides until you add some.

```yaml
# Pin a specific exemplar — overrides auto-selection for that boundary.
# Coordinates are snapped to the nearest mature loss within ~22 m;
# typo or stale pin → script logs a warning, falls back to auto-select.
pin:
  neighborhoods:
    "Squirrel Hill North":
      centroid_lat: 40.4406
      centroid_lon: -79.9251

# Blocklist — exclude these losses everywhere. Pipeline will pick the
# next-largest qualifying loss for any boundary that would have
# selected one of these. Useful when Google Street View imagery is
# missing or unhelpful for a given location.
blocklist:
  - centroid_lat: 40.4400
    centroid_lon: -79.9300
    note: "no Street View coverage pre-2018"
```

Workflow when you discover a poor exemplar in production:

1. Open the map, click the boundary, click the CTA shape — confirm the
   Street View is missing/unhelpful.
2. Grab the loss centroid from the URL share button (the `tree=` param
   in the hash carries `lat,lng`) or from QGIS by clicking the polygon.
3. Add it to `blocklist:` (or use `pin:` if you already know the better
   exemplar's coordinates).
4. Re-run script 08 (1–3 min). Redeploy.

The same `exemplar_overrides.yaml` file is read by both this default
pipeline and the experimental public pipeline so overrides apply
uniformly across both data sources.

---

## Coordinate Reference Systems

| Stage | CRS | Why |
|-------|-----|-----|
| Source canopy data | EPSG:2272 (PA South, US survey feet) | Original survey CRS |
| Source roads | EPSG:4269 (NAD83 geographic) | City of Pittsburgh roads dataset |
| Intermediate | EPSG:2272 | Preserved for accurate area/distance calculations |
| Web output | EPSG:4326 (WGS84) | Required by GeoJSON spec and MapLibre GL JS |

The street buffer (script 04) reprojects roads from EPSG:4269 to EPSG:2272
before buffering, so the 50 ft distance is in the correct linear unit
(US survey feet).

## QGIS Inspection

All output GeoJSON files can be opened in QGIS 3.x via:
`Layer > Add Layer > Add Vector Layer`

Suggested symbology for `mature_tree_losses.geojson`:
- Categorize by `size_category`
- `tree` → red (`#e74c3c`)
- `grove` → dark red (`#922b21`)

Suggested symbology for `street_stats.geojson`:
- Graduated color by `street_loss_pct_of_area` or `street_loss_pct_of_2015_canopy`
