"""
03_generate_pmtiles.py

Converts GeoJSON output files into PMTiles vector tile archives for
efficient web map rendering via MapLibre GL JS.

PMTiles is a single-file tile archive format. MapLibre streams only the
tiles visible in the current viewport, so even large datasets render
smoothly in the browser regardless of total file size.

The GeoJSON source files produced by earlier scripts are preserved as-is
for direct inspection in QGIS and other desktop GIS tools. This script
adds the web-optimised counterpart alongside each source file.

Currently tiled:
  mature_tree_losses.geojson  → mature_tree_losses.pmtiles
    Zoom range 12–18. At low zooms tippecanoe drops the smallest polygons
    first (individual trees before groves), so high-density areas remain
    readable without tile overflow.

Boundary layers (neighborhoods, parks, districts) remain as plain GeoJSON
because they have at most 215 features and are well within browser limits.

Usage:
  python3 scripts/03_generate_pmtiles.py

Requires:
  tippecanoe  (https://github.com/felt/tippecanoe)
  Install on Ubuntu/Debian: sudo apt-get install tippecanoe
"""

import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

CANOPY_DIR = REPO_ROOT / "data-pipeline" / "output" / "canopy_change"

# Tile configuration for mature tree loss polygons
TREE_LOSS_CONFIG = {
    "input":  CANOPY_DIR / "mature_tree_losses.geojson",
    "output": CANOPY_DIR / "mature_tree_losses.pmtiles",
    "layer":  "mature_tree_losses",
    # Zoom 12: neighbourhood overview — groves only visible at this scale
    # Zoom 18: full detail, individual 0.04-acre polygons clearly visible
    "min_zoom": 12,
    "max_zoom": 18,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def check_tippecanoe() -> None:
    result = subprocess.run(
        ["tippecanoe", "--version"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("ERROR: tippecanoe not found.", file=sys.stderr)
        print("Install with: sudo apt-get install tippecanoe", file=sys.stderr)
        sys.exit(1)
    version = result.stderr.strip() or result.stdout.strip()
    print(f"tippecanoe: {version}")


def build_pmtiles(cfg: dict) -> None:
    """Run tippecanoe for a single input/output pair."""
    src  = cfg["input"]
    dest = cfg["output"]

    if not src.exists():
        print(f"  ERROR: input not found: {src}", file=sys.stderr)
        print(f"  Run the earlier pipeline scripts first.", file=sys.stderr)
        sys.exit(1)

    print(f"\nGenerating {dest.name} …")
    print(f"  Source:    {src.name}  ({src.stat().st_size / 1e6:.1f} MB)")
    print(f"  Layer:     {cfg['layer']}")
    print(f"  Zoom:      {cfg['min_zoom']}–{cfg['max_zoom']}")
    print(f"  (tippecanoe may take 1–3 minutes for large inputs)")

    cmd = [
        "tippecanoe",
        "--output",          str(dest),
        "--layer",           cfg["layer"],
        "--minimum-zoom",    str(cfg["min_zoom"]),
        "--maximum-zoom",    str(cfg["max_zoom"]),
        # At overflowing zoom levels, drop the smallest polygons first.
        # This means individual trees are thinned before groves, preserving
        # the most visually significant losses at lower zoom levels.
        "--drop-smallest-as-needed",
        # Simplify geometry proportionally at lower zoom levels while
        # preserving full resolution at max zoom.
        "--simplification=2",
        # Overwrite any existing output file
        "--force",
        str(src),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print("\nERROR: tippecanoe failed:", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    size_mb = dest.stat().st_size / 1e6
    print(f"  ✓ {dest.name}  ({size_mb:.1f} MB)")

    if result.stderr:
        # tippecanoe prints progress to stderr — show last few lines as summary
        lines = [l for l in result.stderr.strip().splitlines() if l]
        for line in lines[-5:]:
            print(f"    {line}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    check_tippecanoe()
    build_pmtiles(TREE_LOSS_CONFIG)
    print("\nDone.")
    print("\nWeb files:  data-pipeline/output/canopy_change/mature_tree_losses.pmtiles")
    print("QGIS files: data-pipeline/output/canopy_change/mature_tree_losses.geojson")
    print("\nIn MapLibre, reference the .pmtiles file using the pmtiles:// protocol.")


if __name__ == "__main__":
    main()
