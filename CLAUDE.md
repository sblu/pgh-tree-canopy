# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pittsburgh tree canopy gain/loss visualization (2015–2020) for Squirrel Hill Urban Coalition. Two independent components: a Python data pipeline and a React web app.

## Commands

### Web App (run from `web-app/`)
```bash
npm install
npm run dev        # Vite dev server (HTTPS, localhost:5173)
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

### Dev Setup
```bash
cd web-app && ln -s ../../data-pipeline/output public/data
```

## Architecture

**Data Pipeline:** Numbered Python scripts (01–07) read ESRI GeoDatabase files via geopandas/pyogrio, compute canopy metrics, and output GeoJSON (for QGIS inspection) + PMTiles (for web via tippecanoe). Scripts must run in order.

**Web App:** React 19 + Vite + MapLibre GL JS + react-map-gl. State lives in `App.jsx` and is passed as props (no state library). Data fetched/cached in `hooks/useLayerData.js`. Layer config centralized in `config/layers.js`. PMTiles loaded via pmtiles protocol for efficient tile streaming.

**Data flow:** `source-gis-data/*.gdb` → Python scripts → `data-pipeline/output/` → symlinked to `web-app/public/data/` → fetched by MapLibre at runtime.

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
