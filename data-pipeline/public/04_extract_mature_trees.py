"""
04_extract_mature_trees.py

Filters the derived canopy loss and gain polygons to those representing
mature individual trees or groves (>= 0.04 acres).

Uses the loss/gain GeoPackages produced by 01_derive_canopy_change.py.

Filtering thresholds (from config.py):
  >= 0.04 acres  → single mature tree   (size_category = "tree")
  >= 0.07 acres  → 2+ mature trees/grove (size_category = "grove")

Usage:
  python3 data-pipeline/public/04_extract_mature_trees.py

Outputs written to: data-pipeline/output_public/canopy_change/
  mature_tree_losses.geojson    Loss polygons >= 0.04 acres (EPSG:4326)
  mature_tree_gains.geojson     Gain polygons >= 0.04 acres (EPSG:4326)
"""

import geopandas as gpd
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import OUTPUT_DIR, CRS_WEB, SQ_FT_PER_ACRE, THRESHOLDS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CANOPY_DIR = OUTPUT_DIR / "canopy_change"

LOSS_PATH = CANOPY_DIR / "canopy_loss_2015_2020.gpkg"
GAIN_PATH = CANOPY_DIR / "canopy_gain_2015_2020.gpkg"

THRESHOLD_TREE = THRESHOLDS["mature_tree_acres"]   # 0.04
THRESHOLD_GROVE = THRESHOLDS["grove_acres"]         # 0.07


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_mature(input_path, output_name, acres_field):
    """
    Filter canopy polygons to mature trees (>= THRESHOLD_TREE acres),
    classify by size, compute centroids, save as GeoJSON.
    """
    print(f"  Loading {input_path.name} ...")
    t0 = time.time()
    gdf = gpd.read_file(input_path)
    print(f"  Loaded {len(gdf):,} features ({time.time()-t0:.0f}s)")

    # Ensure acres are computed
    if "acres" not in gdf.columns:
        gdf["acres"] = gdf.geometry.area / SQ_FT_PER_ACRE

    # Filter to mature (>= 0.04 acres)
    mature = gdf[gdf["acres"] >= THRESHOLD_TREE].copy()
    print(f"  Filtered to {len(mature):,} features >= {THRESHOLD_TREE} acres")

    if len(mature) == 0:
        print(f"  [WARN] No features above threshold — skipping {output_name}")
        return

    # Classify by size
    mature["size_category"] = mature["acres"].apply(
        lambda a: "grove" if a >= THRESHOLD_GROVE else "tree"
    )

    # Rename acres field to match expected schema
    mature = mature.rename(columns={"acres": acres_field})

    # Compute centroids (in source CRS for accuracy, then extract in WGS84)
    centroids_proj = mature.geometry.centroid
    centroid_gdf = gpd.GeoDataFrame(
        geometry=centroids_proj, crs=mature.crs
    ).to_crs(CRS_WEB)
    mature["centroid_lon"] = centroid_gdf.geometry.x.round(6)
    mature["centroid_lat"] = centroid_gdf.geometry.y.round(6)

    # Select output fields
    out = mature[[acres_field, "size_category",
                   "centroid_lon", "centroid_lat", "geometry"]].copy()

    # Round acres
    out[acres_field] = out[acres_field].round(4)

    # Reproject to WGS84
    out = out.to_crs(CRS_WEB)

    # Save
    out_path = CANOPY_DIR / f"{output_name}.geojson"
    out.to_file(out_path, driver="GeoJSON")
    size_mb = out_path.stat().st_size / (1024 * 1024)

    trees = len(out[out["size_category"] == "tree"])
    groves = len(out[out["size_category"] == "grove"])
    print(f"  Saved: {len(out):,} features ({trees:,} trees, {groves:,} groves) "
          f"→ {output_name}.geojson ({size_mb:.1f} MB)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    CANOPY_DIR.mkdir(parents=True, exist_ok=True)

    print("Extracting mature tree losses ...")
    if LOSS_PATH.exists():
        extract_mature(LOSS_PATH, "mature_tree_losses", "loss_acres")
    else:
        print(f"  [SKIP] {LOSS_PATH.name} not found — run 01_derive_canopy_change.py")

    print()

    print("Extracting mature tree gains ...")
    if GAIN_PATH.exists():
        extract_mature(GAIN_PATH, "mature_tree_gains", "gain_acres")
    else:
        print(f"  [SKIP] {GAIN_PATH.name} not found — run 01_derive_canopy_change.py")


if __name__ == "__main__":
    main()
