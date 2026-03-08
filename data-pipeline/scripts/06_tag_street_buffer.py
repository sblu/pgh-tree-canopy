"""
06_tag_street_buffer.py

Adds an `in_street_buffer` boolean property to each mature tree loss and gain
polygon indicating whether it intersects the dissolved street buffer area.

This enables the web app to filter gain/loss polygons to show only those
within street tree areas, without clipping the polygon geometries.

After tagging, regenerates the PMTiles files so the new property is available
in vector tiles.

Usage:
  python3 scripts/06_tag_street_buffer.py
"""

import json
import subprocess
import sys
from pathlib import Path

import geopandas as gpd
from shapely.prepared import prep

REPO_ROOT = Path(__file__).resolve().parents[2]
CANOPY_DIR = REPO_ROOT / "data-pipeline" / "output" / "canopy_change"
STREETS_DIR = REPO_ROOT / "data-pipeline" / "output" / "streets"

BUFFER_PATH = STREETS_DIR / "street_buffer_area.geojson"

DATASETS = [
    {
        "path": CANOPY_DIR / "mature_tree_losses.geojson",
        "pmtiles": CANOPY_DIR / "mature_tree_losses.pmtiles",
        "layer": "mature_tree_losses",
    },
    {
        "path": CANOPY_DIR / "mature_tree_gains.geojson",
        "pmtiles": CANOPY_DIR / "mature_tree_gains.pmtiles",
        "layer": "mature_tree_gains",
    },
]

TILE_CONFIG = {
    "min_zoom": 12,
    "max_zoom": 18,
}


def tag_dataset(dataset: dict, buffer_geom) -> None:
    path = dataset["path"]
    print(f"\nTagging {path.name} …")

    gdf = gpd.read_file(path)
    print(f"  {len(gdf)} features loaded")

    # Use prepared geometry for fast intersects checks
    prepared = prep(buffer_geom)
    gdf["in_street_buffer"] = gdf.geometry.apply(
        lambda g: 1 if prepared.intersects(g) else 0
    )

    in_count = int(gdf["in_street_buffer"].sum())
    print(f"  {in_count} features intersect street buffer ({in_count/len(gdf)*100:.1f}%)")

    # Save back — use json for smaller output
    gdf.to_file(path, driver="GeoJSON")
    size_mb = path.stat().st_size / 1e6
    print(f"  Saved {path.name} ({size_mb:.1f} MB)")


def build_pmtiles(dataset: dict) -> None:
    src = dataset["path"]
    dest = dataset["pmtiles"]
    layer = dataset["layer"]

    print(f"\nGenerating {dest.name} …")
    cmd = [
        "tippecanoe",
        "--output", str(dest),
        "--layer", layer,
        "--minimum-zoom", str(TILE_CONFIG["min_zoom"]),
        "--maximum-zoom", str(TILE_CONFIG["max_zoom"]),
        "--drop-smallest-as-needed",
        "--simplification=2",
        "--force",
        str(src),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ERROR: tippecanoe failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    size_mb = dest.stat().st_size / 1e6
    print(f"  {dest.name} ({size_mb:.1f} MB)")


def main() -> None:
    if not BUFFER_PATH.exists():
        print(f"ERROR: Street buffer not found: {BUFFER_PATH}", file=sys.stderr)
        sys.exit(1)

    # Load the dissolved street buffer
    print("Loading street buffer …")
    buffer_gdf = gpd.read_file(BUFFER_PATH)
    # Dissolve to a single geometry for intersection test
    buffer_geom = buffer_gdf.union_all()
    print(f"  Buffer loaded ({BUFFER_PATH.stat().st_size / 1e6:.1f} MB)")

    # Tag each dataset
    for ds in DATASETS:
        if not ds["path"].exists():
            print(f"  Skipping {ds['path'].name} (not found)")
            continue
        tag_dataset(ds, buffer_geom)

    # Regenerate PMTiles
    # Check tippecanoe is available
    result = subprocess.run(["tippecanoe", "--version"], capture_output=True, text=True)
    if result.returncode != 0:
        print("WARNING: tippecanoe not found — skipping PMTiles generation", file=sys.stderr)
        print("Install with: sudo apt-get install tippecanoe", file=sys.stderr)
        return

    for ds in DATASETS:
        if ds["path"].exists():
            build_pmtiles(ds)

    print("\nDone. PMTiles files regenerated with in_street_buffer property.")


if __name__ == "__main__":
    main()
