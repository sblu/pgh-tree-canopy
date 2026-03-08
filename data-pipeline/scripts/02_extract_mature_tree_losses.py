"""
02_extract_mature_tree_losses.py

Extracts canopy loss polygons that represent mature individual trees or
tree groves from the Allegheny County tree canopy change dataset.

Filtering logic (from PROJECT-OVERVIEW.md):
  >= 0.04 acres  → single mature tree   (size_category = "tree")
  >= 0.07 acres  → 2+ mature trees/grove (size_category = "grove")

Only Change Class 3 (loss) polygons are included.

These features are intended for display as individual point-of-interest
polygons on the web map at high zoom levels, colored by size category:
  tree  → red
  grove → dark red

A future milestone will add a link to Google Street View historical imagery
for each polygon centroid to allow before/after inspection.

Usage:
  python3 scripts/02_extract_mature_tree_losses.py

Output written to: output/canopy_change/
  mature_tree_losses.geojson
"""

import geopandas as gpd
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

SOURCE_GDB = REPO_ROOT / "source-gis-data" / "TreeCanopyChange_2015_2020_AlleghenyCounty.gdb"

OUTPUT_DIR = REPO_ROOT / "data-pipeline" / "output" / "canopy_change"

TARGET_CRS = "EPSG:4326"

# Canopy area thresholds (acres) as defined in PROJECT-OVERVIEW.md
THRESHOLD_TREE  = 0.04  # single mature tree
THRESHOLD_GROVE = 0.07  # 2+ mature trees / grove

CHANGE_CLASS_LOSS = 3   # Change class value for canopy loss

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    if not SOURCE_GDB.exists():
        print(f"ERROR: Source GDB not found at:\n  {SOURCE_GDB}", file=sys.stderr)
        sys.exit(1)

    print(f"Source: {SOURCE_GDB}")
    print(f"Output: {OUTPUT_DIR}\n")

    # Read only loss polygons >= the minimum threshold directly from the GDB.
    # Using a WHERE clause avoids loading all 3.3M features into memory.
    print(f"Reading loss polygons >= {THRESHOLD_TREE} acres from TreeCanopyChange layer …")
    print("(This may take 30–60 seconds for the full county dataset)")

    where_clause = f"Change = {CHANGE_CLASS_LOSS} AND Acres >= {THRESHOLD_TREE}"

    gdf = gpd.read_file(
        SOURCE_GDB,
        layer="TreeCanopyChange_2015_2020_AlleghenyCounty",
        where=where_clause,
    )

    print(f"  Raw loss polygons loaded: {len(gdf)}")

    # Assign size category
    gdf["size_category"] = gdf["Acres"].apply(
        lambda a: "grove" if a >= THRESHOLD_GROVE else "tree"
    )

    trees  = (gdf["size_category"] == "tree").sum()
    groves = (gdf["size_category"] == "grove").sum()
    print(f"  Mature trees  (>= {THRESHOLD_TREE} acres): {trees + groves}")
    print(f"    Single tree (< {THRESHOLD_GROVE} acres): {trees}")
    print(f"    Grove       (>= {THRESHOLD_GROVE} acres): {groves}")

    # Select and rename fields
    out = gdf[["Acres", "size_category", "geometry"]].copy()
    out = out.rename(columns={"Acres": "loss_acres"})

    # Add centroid coordinates in WGS84 for future Street View integration.
    # Centroids are computed in the source projected CRS for accuracy,
    # then the full layer is reprojected to WGS84.
    centroids_proj = gdf.geometry.centroid
    centroid_gdf = gpd.GeoDataFrame(geometry=centroids_proj, crs=gdf.crs).to_crs(TARGET_CRS)
    out["centroid_lon"] = centroid_gdf.geometry.x.round(6)
    out["centroid_lat"] = centroid_gdf.geometry.y.round(6)

    # Reproject geometry to WGS84
    out = out.to_crs(TARGET_CRS)

    # Write output
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "mature_tree_losses.geojson"
    out.to_file(output_path, driver="GeoJSON")

    print(f"\n  ✓ {len(out)} features → {output_path.name}")
    print("\nDone. Open in QGIS: Layer > Add Layer > Add Vector Layer")
    print("  Suggested symbology: categorize by 'size_category'")
    print("    tree  → red (#e74c3c)")
    print("    grove → dark red (#922b21)")


if __name__ == "__main__":
    main()
