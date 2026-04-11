"""
08_tag_street_buffer.py

Adds an `in_street_buffer` boolean tag (0 or 1) to mature tree loss and
gain polygons, indicating whether each polygon intersects the 50 ft street
buffer. Then regenerates PMTiles with the new field.

Usage:
  python3 data-pipeline/public/08_tag_street_buffer.py

Requires: output from 04 (mature trees), 06 (street buffer)
Updates:  mature_tree_losses.geojson, mature_tree_gains.geojson
Regenerates: mature_tree_losses.pmtiles, mature_tree_gains.pmtiles
"""

import geopandas as gpd
import subprocess
import sys
import time
from pathlib import Path
from shapely.prepared import prep

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import OUTPUT_DIR, TILE_CONFIGS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CANOPY_DIR = OUTPUT_DIR / "canopy_change"
STREETS_DIR = OUTPUT_DIR / "streets"

BUFFER_PATH = STREETS_DIR / "street_buffer_area.geojson"

DATASETS = [
    {
        "geojson": CANOPY_DIR / "mature_tree_losses.geojson",
        "pmtiles": CANOPY_DIR / "mature_tree_losses.pmtiles",
        "config": TILE_CONFIGS["mature_tree_losses"],
    },
    {
        "geojson": CANOPY_DIR / "mature_tree_gains.geojson",
        "pmtiles": CANOPY_DIR / "mature_tree_gains.pmtiles",
        "config": TILE_CONFIGS["mature_tree_gains"],
    },
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not BUFFER_PATH.exists():
        print(f"ERROR: {BUFFER_PATH} not found — run 06_street_buffer.py first")
        sys.exit(1)

    # Load street buffer
    print("Loading street buffer area ...")
    buffer_gdf = gpd.read_file(BUFFER_PATH)
    buffer_geom = buffer_gdf.geometry.iloc[0]
    prepared_buffer = prep(buffer_geom)
    print(f"  Buffer loaded")

    for ds in DATASETS:
        geojson_path = ds["geojson"]
        if not geojson_path.exists():
            print(f"\n[SKIP] {geojson_path.name} not found")
            continue

        print(f"\nProcessing {geojson_path.name} ...")
        t0 = time.time()
        gdf = gpd.read_file(geojson_path)
        print(f"  Loaded {len(gdf):,} features")

        # Tag each polygon
        print("  Tagging in_street_buffer ...")
        gdf["in_street_buffer"] = gdf.geometry.apply(
            lambda g: 1 if prepared_buffer.intersects(g) else 0
        )

        in_buf = gdf["in_street_buffer"].sum()
        print(f"  {in_buf:,} / {len(gdf):,} in street buffer "
              f"({in_buf/len(gdf)*100:.1f}%)")

        # Save updated GeoJSON
        gdf.to_file(geojson_path, driver="GeoJSON")
        print(f"  Updated {geojson_path.name}")

        # Regenerate PMTiles
        pmtiles_path = ds["pmtiles"]
        config = ds["config"]
        cmd = [
            "tippecanoe",
            "--output", str(pmtiles_path),
            "--layer", config["layer"],
            "--minimum-zoom", str(config["min_zoom"]),
            "--maximum-zoom", str(config["max_zoom"]),
            "--drop-smallest-as-needed",
            f"--simplification={config['simplification']}",
            "--force",
            str(geojson_path),
        ]
        print(f"  Regenerating PMTiles ...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  [ERROR] tippecanoe failed:\n{result.stderr}")
        else:
            size_mb = pmtiles_path.stat().st_size / (1024**2)
            print(f"  {pmtiles_path.name} ({size_mb:.1f} MB)")

        print(f"  Done ({time.time()-t0:.0f}s)")


if __name__ == "__main__":
    main()
