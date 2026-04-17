# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pittsburgh tree canopy gain/loss visualization (2015–2020) for Squirrel Hill Urban Coalition. Two independent components: a Python data pipeline and a React web app.

## Commands

### Web App (run from `web-app/`)
```bash
npm install
npm run dev        # Vite dev server (HTTP, localhost:5173, all interfaces)
npm run build      # Production build → dist/
npm run lint       # ESLint (flat config, React hooks)
npm run preview    # Preview production build
```

### Data Pipeline (run from repo root)
```bash
pip install -r data-pipeline/requirements.txt
python3 data-pipeline/scripts/01_extract_boundary_layers.py
python3 data-pipeline/scripts/02_extract_mature_tree_losses.py
python3 data-pipeline/scripts/03_generate_pmtiles.py
python3 data-pipeline/scripts/04_street_buffer.py
python3 data-pipeline/scripts/05_street_canopy_stats.py    # ~10-30 min
python3 data-pipeline/scripts/06_tag_street_buffer.py
python3 data-pipeline/scripts/07_full_canopy_change.py     # ~15-30 min
```

There is also an **experimental public pipeline** under
`data-pipeline/public/` that reproduces the analysis from publicly
downloadable PASDA data (no GDB required). It is **not** used in
production — it yields a ~4.1% larger 2015 canopy estimate than the
refined GDB. Treat it as an alternative / reference implementation,
not the source of truth. See `data-pipeline/public/README.md` for
details and when you'd use it.

### Dev Setup

`web-app/public/data/` and `web-app/public/data-public/` are not committed to git. They must be created locally with selective symlinks to the pipeline output — only the files the web app actually loads (QGIS-inspection GeoJSON and .gpkg files are excluded to keep `dist/` lean).

Run once from repo root after cloning or after re-running the pipeline:

```bash
# data/ — main (default) pipeline
mkdir -p web-app/public/data/canopy_change web-app/public/data/streets
ln -s ../../../data-pipeline/output/boundary_layers          web-app/public/data/boundary_layers
ln -s ../../../../data-pipeline/output/canopy_change/canopy_change_all.pmtiles  web-app/public/data/canopy_change/canopy_change_all.pmtiles
ln -s ../../../../data-pipeline/output/canopy_change/mature_tree_losses.pmtiles web-app/public/data/canopy_change/mature_tree_losses.pmtiles
ln -s ../../../../data-pipeline/output/canopy_change/mature_tree_gains.pmtiles  web-app/public/data/canopy_change/mature_tree_gains.pmtiles
ln -s ../../../../data-pipeline/output/streets/street_stats.geojson         web-app/public/data/streets/street_stats.geojson
ln -s ../../../../data-pipeline/output/streets/street_buffer_area.geojson   web-app/public/data/streets/street_buffer_area.geojson
ln -s ../../../../data-pipeline/output/streets/street_centerlines.geojson   web-app/public/data/streets/street_centerlines.geojson

# data-public/ — experimental public pipeline (?source=public toggle)
mkdir -p web-app/public/data-public/canopy_change web-app/public/data-public/streets
ln -s ../../../data-pipeline/output_public/boundary_layers          web-app/public/data-public/boundary_layers
ln -s ../../../../data-pipeline/output_public/canopy_change/canopy_change_all.pmtiles  web-app/public/data-public/canopy_change/canopy_change_all.pmtiles
ln -s ../../../../data-pipeline/output_public/canopy_change/mature_tree_losses.pmtiles web-app/public/data-public/canopy_change/mature_tree_losses.pmtiles
ln -s ../../../../data-pipeline/output_public/canopy_change/mature_tree_gains.pmtiles  web-app/public/data-public/canopy_change/mature_tree_gains.pmtiles
ln -s ../../../../data-pipeline/output_public/streets/street_stats.geojson         web-app/public/data-public/streets/street_stats.geojson
ln -s ../../../../data-pipeline/output_public/streets/street_buffer_area.geojson   web-app/public/data-public/streets/street_buffer_area.geojson
ln -s ../../../../data-pipeline/output_public/streets/street_centerlines.geojson   web-app/public/data-public/streets/street_centerlines.geojson
```

## Architecture

**Data Pipeline (default):** Numbered Python scripts (01–07) in `data-pipeline/scripts/` read ESRI GeoDatabase files via geopandas/pyogrio, compute canopy metrics, and output GeoJSON (for QGIS inspection) + PMTiles (for web via tippecanoe). Scripts must run in order.

**Data Pipeline (public, experimental):** A parallel set of scripts in `data-pipeline/public/` reproduces the same outputs from publicly downloadable PASDA data. Not used in production — kept for reproducibility research. Writes to `data-pipeline/output_public/`.

**Web App:** React 19 + Vite + MapLibre GL JS + react-map-gl. State lives in `App.jsx` and is passed as props (no state library). Data fetched/cached in `hooks/useLayerData.js`. Layer config centralized in `config/layers.js`. PMTiles loaded via pmtiles protocol for efficient tile streaming. A hidden `?source=public` URL parameter (see `config/dataSource.js`) swaps the data prefix from `data` to `data-public` so the experimental pipeline's output can be previewed side-by-side.

**Data flow:** `source-gis-data/*.gdb` → Python scripts → `data-pipeline/output/` → symlinked to `web-app/public/data/` → fetched by MapLibre at runtime. The experimental pipeline uses a parallel path: `public-gis-data/` → `data-pipeline/public/` → `data-pipeline/output_public/` → `web-app/public/data-public/`.

## Coordinate Systems

- **EPSG:2272** (PA South State Plane, US survey feet): used for all area/distance computation in Python (50ft street buffers, acreage calculations)
- **EPSG:4326** (WGS84): all web-facing outputs (GeoJSON and PMTiles)

Always reproject to EPSG:2272 before spatial operations that depend on linear units, then reproject results to EPSG:4326 for output.

## Key Conventions

- **Dual-output principle:** every pipeline dataset produces both web format (GeoJSON/PMTiles) and QGIS-inspectable format
- **Python scripts:** config block at top (REPO_ROOT, SOURCE_GDB, OUTPUT_DIR), `main()` entry point, pathlib for paths, progress printing to stdout
- **React:** functional components with hooks, useMemo/useCallback for performance, inline styles or index.css
- **Git commits:** imperative voice ("Fix X", "Add Y"), specific about what changed
- **No test framework** for either component; data QA is done via QGIS visual inspection
- Vite uses `base: './'` for portable deployment to any subdirectory
- Large datasets (canopy polygons) use PMTiles; small datasets (boundaries) stay as plain GeoJSON
