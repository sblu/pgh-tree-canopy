"""
05_generate_pmtiles.py

Converts large GeoJSON files to PMTiles vector tile archives using tippecanoe.
PMTiles enable efficient progressive loading in the MapLibre web map.

Usage:
  python3 data-pipeline/public/05_generate_pmtiles.py

Requires: tippecanoe installed (sudo apt-get install tippecanoe)
Requires: output from 04_extract_mature_trees.py

Outputs written to: data-pipeline/output_public/canopy_change/
  mature_tree_losses.pmtiles
  mature_tree_gains.pmtiles
"""

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import OUTPUT_DIR, TILE_CONFIGS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CANOPY_DIR = OUTPUT_DIR / "canopy_change"

DATASETS = [
    {
        "input": CANOPY_DIR / "mature_tree_losses.geojson",
        "output": CANOPY_DIR / "mature_tree_losses.pmtiles",
        "config": TILE_CONFIGS["mature_tree_losses"],
    },
    {
        "input": CANOPY_DIR / "mature_tree_gains.geojson",
        "output": CANOPY_DIR / "mature_tree_gains.pmtiles",
        "config": TILE_CONFIGS["mature_tree_gains"],
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def check_tippecanoe():
    """Verify tippecanoe is installed."""
    try:
        result = subprocess.run(
            ["tippecanoe", "--version"],
            capture_output=True, text=True
        )
        version = result.stderr.strip() or result.stdout.strip()
        print(f"tippecanoe found: {version}")
        return True
    except FileNotFoundError:
        print("[ERROR] tippecanoe not found. Install with: sudo apt-get install tippecanoe")
        return False


def generate_pmtiles(input_path, output_path, config):
    """Run tippecanoe to convert GeoJSON to PMTiles."""
    if not input_path.exists():
        print(f"  [SKIP] {input_path.name} not found")
        return False

    cmd = [
        "tippecanoe",
        "--output", str(output_path),
        "--layer", config["layer"],
        "--minimum-zoom", str(config["min_zoom"]),
        "--maximum-zoom", str(config["max_zoom"]),
        "--drop-smallest-as-needed",
        f"--simplification={config['simplification']}",
        "--force",
        str(input_path),
    ]

    print(f"  Running: {' '.join(cmd[:6])} ...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"  [ERROR] tippecanoe failed:\n{result.stderr}")
        return False

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"  Generated: {output_path.name} ({size_mb:.1f} MB)")
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not check_tippecanoe():
        sys.exit(1)

    for ds in DATASETS:
        print(f"\nProcessing {ds['input'].name} ...")
        generate_pmtiles(ds["input"], ds["output"], ds["config"])

    print("\nPMTiles generation complete.")


if __name__ == "__main__":
    main()
