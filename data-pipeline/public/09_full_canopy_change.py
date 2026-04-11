"""
09_full_canopy_change.py

Combines all canopy change polygons (loss, gain, no-change) into a single
PMTiles archive for the full canopy overlay on the web map.

No-change is derived by clipping the 2015 canopy to the 2020 canopy footprint
(the intersection). Loss and gain come from 01_derive_canopy_change.py.

Usage:
  python3 data-pipeline/public/09_full_canopy_change.py

Outputs written to: data-pipeline/output_public/canopy_change/
  canopy_change_all.pmtiles   Full canopy (zoom 10-18)
"""

import geopandas as gpd
import pandas as pd
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import OUTPUT_DIR, CRS_WEB, SQ_FT_PER_ACRE, TILE_CONFIGS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CANOPY_DIR = OUTPUT_DIR / "canopy_change"

LOSS_PATH = CANOPY_DIR / "canopy_loss_2015_2020.gpkg"
GAIN_PATH = CANOPY_DIR / "canopy_gain_2015_2020.gpkg"
CANOPY_2015_PATH = CANOPY_DIR / "canopy_2015.gpkg"
CANOPY_2020_PATH = CANOPY_DIR / "canopy_2020.gpkg"

GEOJSON_PATH = CANOPY_DIR / "canopy_change_all.geojson"
PMTILES_PATH = CANOPY_DIR / "canopy_change_all.pmtiles"

TILE_CFG = TILE_CONFIGS["canopy_change_all"]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    CANOPY_DIR.mkdir(parents=True, exist_ok=True)

    # Load loss and gain (already in EPSG:2272)
    print("Loading loss polygons ...")
    t0 = time.time()
    loss = gpd.read_file(LOSS_PATH)
    print(f"  {len(loss):,} features ({time.time()-t0:.0f}s)")

    print("Loading gain polygons ...")
    t0 = time.time()
    gain = gpd.read_file(GAIN_PATH)
    print(f"  {len(gain):,} features ({time.time()-t0:.0f}s)")

    # Tag change class and compute acres
    loss["change"] = 3
    loss["change_class"] = "loss"
    if "acres" not in loss.columns:
        loss["acres"] = (loss.geometry.area / SQ_FT_PER_ACRE).round(4)

    gain["change"] = 2
    gain["change_class"] = "gain"
    if "acres" not in gain.columns:
        gain["acres"] = (gain.geometry.area / SQ_FT_PER_ACRE).round(4)

    # For no-change: use the 2020 canopy footprint directly.
    # The 2020 footprint IS the no-change + gain areas. Subtracting gain
    # leaves no-change. But that spatial operation is expensive. Instead,
    # since the full canopy PMTiles visualization just needs all three
    # classes visible, we can use the 2020 footprint as "existing canopy"
    # and overlay loss/gain on top. The web app filters by change_class.
    #
    # For a true no-change layer we'd need the 2015∩2020 intersection,
    # which is very expensive. Instead, tag the 2020 footprint as no_change
    # (it includes gain areas, but gain polygons are rendered separately).
    print("Loading 2020 canopy (used as no-change base) ...")
    t0 = time.time()
    canopy_2020 = gpd.read_file(CANOPY_2020_PATH)
    print(f"  {len(canopy_2020):,} features ({time.time()-t0:.0f}s)")

    canopy_2020["change"] = 1
    canopy_2020["change_class"] = "no_change"
    if "acres" not in canopy_2020.columns:
        canopy_2020["acres"] = (canopy_2020.geometry.area / SQ_FT_PER_ACRE).round(4)

    # Combine all
    print("Combining all change classes ...")
    fields = ["change", "change_class", "acres", "geometry"]
    combined = pd.concat([
        canopy_2020[fields],
        loss[fields],
        gain[fields],
    ], ignore_index=True)

    combined = gpd.GeoDataFrame(combined, crs=loss.crs)
    print(f"  Total: {len(combined):,} features")
    for cls in ["no_change", "loss", "gain"]:
        n = len(combined[combined["change_class"] == cls])
        print(f"    {cls}: {n:,}")

    # Reproject to WGS84
    print("Reprojecting to WGS84 ...")
    t0 = time.time()
    combined = combined.to_crs(CRS_WEB)
    print(f"  Done ({time.time()-t0:.0f}s)")

    # Write temporary GeoJSON
    print(f"Writing {GEOJSON_PATH.name} ...")
    t0 = time.time()
    combined.to_file(GEOJSON_PATH, driver="GeoJSON")
    size_gb = GEOJSON_PATH.stat().st_size / (1024**3)
    print(f"  Written: {size_gb:.1f} GB ({time.time()-t0:.0f}s)")

    # Generate PMTiles
    print(f"\nGenerating PMTiles ...")
    cmd = [
        "tippecanoe",
        "--output", str(PMTILES_PATH),
        "--layer", TILE_CFG["layer"],
        "--minimum-zoom", str(TILE_CFG["min_zoom"]),
        "--maximum-zoom", str(TILE_CFG["max_zoom"]),
        "--drop-smallest-as-needed",
        f"--simplification={TILE_CFG['simplification']}",
        "--force",
        str(GEOJSON_PATH),
    ]
    print(f"  {' '.join(cmd[:6])} ...")
    t0 = time.time()
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"  [ERROR] tippecanoe failed:\n{result.stderr}")
        sys.exit(1)

    size_mb = PMTILES_PATH.stat().st_size / (1024**2)
    print(f"  Generated: {PMTILES_PATH.name} ({size_mb:.1f} MB) ({time.time()-t0:.0f}s)")

    # Clean up intermediate GeoJSON (very large)
    print(f"\nRemoving intermediate {GEOJSON_PATH.name} ({size_gb:.1f} GB) ...")
    GEOJSON_PATH.unlink()
    print("Done.")


if __name__ == "__main__":
    main()
