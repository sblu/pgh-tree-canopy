"""
02_extract_boundaries.py

Extracts and normalizes administrative boundary layers from PASDA shapefiles.
Computes land_area_acres from polygon geometry in EPSG:2272, subtracting
water area using the Allegheny County hydrology areas dataset.

Canopy statistics are NOT computed here — that happens in script 03.

Usage:
  python3 data-pipeline/public/02_extract_boundaries.py

Outputs written to: data-pipeline/output_public/boundary_layers/
  neighborhoods.geojson
  parks_municipal.geojson
  parks_county.geojson
  city_council_districts.geojson
  county_council_districts.geojson
  municipalities.geojson
"""

import geopandas as gpd
import numpy as np
import sys
from pathlib import Path
from shapely.ops import unary_union
from shapely.validation import make_valid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import BOUNDARY_LAYERS, HYDROLOGY, OUTPUT_DIR, CRS_COMPUTE, CRS_WEB, SQ_FT_PER_ACRE

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BOUNDARY_OUTPUT_DIR = OUTPUT_DIR / "boundary_layers"

HYDROLOGY_SHP = HYDROLOGY["download_dir"] / HYDROLOGY["shapefile_name"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_water_area(zone_geom, hydro_gdf):
    """Compute water area (acres) within a boundary zone using hydrology data."""
    if hydro_gdf is None or len(hydro_gdf) == 0:
        return 0.0

    candidates_idx = list(hydro_gdf.sindex.intersection(zone_geom.bounds))
    if not candidates_idx:
        return 0.0

    candidates = hydro_gdf.iloc[candidates_idx]
    water_area = 0.0
    zg = make_valid(zone_geom) if not zone_geom.is_valid else zone_geom
    for geom in candidates.geometry:
        try:
            if not geom.is_valid:
                geom = make_valid(geom)
            inter = geom.intersection(zg)
            if not inter.is_empty:
                water_area += inter.area
        except Exception:
            continue
    return water_area / SQ_FT_PER_ACRE


# ---------------------------------------------------------------------------
# Layer processors
# ---------------------------------------------------------------------------

def process_layer(layer_key, layer_cfg, hydro_gdf=None):
    """Load a PASDA boundary shapefile, normalize fields, compute area, save."""
    shp_path = layer_cfg["download_dir"] / layer_cfg["shapefile_name"]
    if not shp_path.exists():
        print(f"  [SKIP] {shp_path} not found — run 00_download.py first")
        return

    gdf = gpd.read_file(shp_path)
    print(f"  Loaded {len(gdf)} features from {layer_cfg['shapefile_name']}")
    print(f"  Source CRS: {gdf.crs}")

    # Build output GeoDataFrame with normalized field names
    out = gdf[["geometry"]].copy()

    # Map name field
    name_field = layer_cfg["name_field"]
    name_prefix = layer_cfg.get("name_prefix", "")
    if name_field in gdf.columns:
        out["name"] = name_prefix + gdf[name_field].astype(str)
    else:
        print(f"  [WARN] name_field '{name_field}' not found in {list(gdf.columns)}")
        out["name"] = ""

    # Map extra fields
    for src_field, dst_field in layer_cfg.get("extra_fields", {}).items():
        if src_field in gdf.columns:
            out[dst_field] = gdf[src_field]

    # Reproject to EPSG:2272 for accurate area calculation
    if out.crs is not None and out.crs.to_epsg() != 2272:
        out = out.to_crs(CRS_COMPUTE)
    elif out.crs is None:
        out = out.set_crs(CRS_COMPUTE)

    # Compute land area from geometry, subtracting water
    total_acres = out.geometry.area / SQ_FT_PER_ACRE
    water_acres = np.zeros(len(out))
    if hydro_gdf is not None:
        for i, (_, row) in enumerate(out.iterrows()):
            water_acres[i] = compute_water_area(row.geometry, hydro_gdf)
    out["land_area_acres"] = (total_acres - water_acres).round(4)

    # Reproject to WGS84 for web output
    out = out.to_crs(CRS_WEB)

    # Save
    out_path = BOUNDARY_OUTPUT_DIR / f"{layer_key}.geojson"
    out.to_file(out_path, driver="GeoJSON")
    total_acres = out["land_area_acres"].sum()
    print(f"  Saved: {len(out)} features, {total_acres:,.1f} total acres → {out_path.name}")

    return out


def process_parks_municipal(layer_cfg, hydro_gdf=None):
    """Special handling: use updatepknm, fall back to origpkname if blank."""
    shp_path = layer_cfg["download_dir"] / layer_cfg["shapefile_name"]
    gdf = gpd.read_file(shp_path)
    print(f"  Loaded {len(gdf)} features from {layer_cfg['shapefile_name']}")

    out = gdf[["geometry"]].copy()

    # Park name: prefer updatepknm, fall back to origpkname
    out["name"] = gdf["updatepknm"].where(
        gdf["updatepknm"].str.strip() != "", gdf["origpkname"]
    )

    # Reproject for area
    if out.crs is not None and out.crs.to_epsg() != 2272:
        out = out.to_crs(CRS_COMPUTE)

    total_acres = out.geometry.area / SQ_FT_PER_ACRE
    water_acres = np.zeros(len(out))
    if hydro_gdf is not None:
        for i, (_, row) in enumerate(out.iterrows()):
            water_acres[i] = compute_water_area(row.geometry, hydro_gdf)
    out["land_area_acres"] = (total_acres - water_acres).round(4)
    out = out.to_crs(CRS_WEB)

    out_path = BOUNDARY_OUTPUT_DIR / "parks_municipal.geojson"
    out.to_file(out_path, driver="GeoJSON")
    print(f"  Saved: {len(out)} features, {out['land_area_acres'].sum():,.1f} acres → {out_path.name}")


def process_neighborhoods(layer_cfg, hydro_gdf=None):
    """Special handling: include hood_no field."""
    shp_path = layer_cfg["download_dir"] / layer_cfg["shapefile_name"]
    gdf = gpd.read_file(shp_path)
    print(f"  Loaded {len(gdf)} features from {layer_cfg['shapefile_name']}")

    out = gdf[["geometry"]].copy()
    out["name"] = gdf["hood"]
    if "hood_no" in gdf.columns:
        out["hood_no"] = gdf["hood_no"]

    # Neighborhoods shapefile is already EPSG:4326 — reproject to 2272 for area
    out_proj = out.to_crs(CRS_COMPUTE)
    total_acres = out_proj.geometry.area / SQ_FT_PER_ACRE
    water_acres = np.zeros(len(out))
    if hydro_gdf is not None:
        for i, (_, row) in enumerate(out_proj.iterrows()):
            water_acres[i] = compute_water_area(row.geometry, hydro_gdf)
    out["land_area_acres"] = (total_acres - water_acres).round(4)

    # Already in WGS84
    if out.crs.to_epsg() != 4326:
        out = out.to_crs(CRS_WEB)

    out_path = BOUNDARY_OUTPUT_DIR / "neighborhoods.geojson"
    out.to_file(out_path, driver="GeoJSON")
    print(f"  Saved: {len(out)} features, {out['land_area_acres'].sum():,.1f} acres → {out_path.name}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    BOUNDARY_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load hydrology for water area subtraction
    hydro_gdf = None
    if HYDROLOGY_SHP.exists():
        print("Loading hydrology areas for water subtraction ...")
        hydro_gdf = gpd.read_file(HYDROLOGY_SHP)
        if hydro_gdf.crs.to_epsg() != 2272:
            hydro_gdf = hydro_gdf.to_crs(CRS_COMPUTE)
        hydro_gdf.sindex  # build spatial index
        total_water = hydro_gdf.geometry.area.sum() / SQ_FT_PER_ACRE
        print(f"  {len(hydro_gdf):,} water features, {total_water:,.1f} total acres")
    else:
        print(f"[WARN] Hydrology shapefile not found at {HYDROLOGY_SHP}")
        print("  Land areas will NOT have water subtracted. Run 00_download.py first.")

    for layer_key, layer_cfg in BOUNDARY_LAYERS.items():
        print(f"\nProcessing {layer_cfg['display_name']} ...")

        if layer_key == "neighborhoods":
            process_neighborhoods(layer_cfg, hydro_gdf)
        elif layer_key == "parks_municipal":
            process_parks_municipal(layer_cfg, hydro_gdf)
        else:
            process_layer(layer_key, layer_cfg, hydro_gdf)

    print("\nAll boundary layers extracted.")


if __name__ == "__main__":
    main()
