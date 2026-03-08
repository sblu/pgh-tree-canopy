"""
07_full_canopy_change.py

Extracts the full TreeCanopyChange_2015_2020_AlleghenyCounty layer (3.3M
polygons) and converts it to PMTiles for efficient web map rendering.

Each polygon is classified as:
  Change = 1 → No Change
  Change = 2 → Gain
  Change = 3 → Loss

The web app shows these as a toggleable overlay colored by change class.
At low zoom, tippecanoe drops the smallest polygons first so the map
remains readable.

Reports progress at each major step with elapsed/estimated times.

Usage:
  python3 scripts/07_full_canopy_change.py

Outputs:
  output/canopy_change/canopy_change_all.pmtiles
"""

import subprocess
import sys
import time
from pathlib import Path

import geopandas as gpd

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_GDB = REPO_ROOT / "source-gis-data" / "TreeCanopyChange_2015_2020_AlleghenyCounty.gdb"
OUTPUT_DIR = REPO_ROOT / "data-pipeline" / "output" / "canopy_change"
GEOJSON_PATH = OUTPUT_DIR / "canopy_change_all.geojson"
PMTILES_PATH = OUTPUT_DIR / "canopy_change_all.pmtiles"

TARGET_CRS = "EPSG:4326"
LAYER_NAME = "canopy_change_all"
LAYER_IN_GDB = "TreeCanopyChange_2015_2020_AlleghenyCounty"

CHANGE_LABELS = {1: "no_change", 2: "gain", 3: "loss"}


def fmt_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    if m < 60:
        return f"{m}:{s:02d}"
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}"


def step(msg: str):
    """Print a timestamped step message and return start time."""
    print(f"\n[Step] {msg}", flush=True)
    return time.time()


def done(start: float, detail: str = ""):
    elapsed = time.time() - start
    extra = f" — {detail}" if detail else ""
    print(f"  ✓ Done in {fmt_time(elapsed)}{extra}", flush=True)


def extract_canopy_change() -> None:
    """Read full canopy change layer, simplify fields, export as GeoJSON."""
    overall_start = time.time()

    # Step 1: Read from GDB
    t = step(f"Reading {LAYER_IN_GDB} from GDB (3.3M features, may take 3–8 min) …")
    gdf = gpd.read_file(SOURCE_GDB, layer=LAYER_IN_GDB)
    done(t, f"{len(gdf):,} features loaded")

    # Step 2: Select and transform fields
    t = step("Selecting fields and mapping change classes …")
    out = gdf[["Change", "Acres", "geometry"]].copy()
    del gdf  # free memory
    out = out.rename(columns={"Change": "change", "Acres": "acres"})
    out["change_class"] = out["change"].map(CHANGE_LABELS).fillna("unknown")
    out["acres"] = out["acres"].round(4)
    done(t, f"{len(out):,} features")

    # Step 3: Reproject
    t = step("Reprojecting to WGS84 (may take 1–3 min) …")
    out = out.to_crs(TARGET_CRS)
    done(t)

    # Step 4: Write GeoJSON
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    t = step(f"Writing {GEOJSON_PATH.name} (may take 2–5 min for 3.3M features) …")
    out.to_file(GEOJSON_PATH, driver="GeoJSON")
    size_mb = GEOJSON_PATH.stat().st_size / 1e6
    done(t, f"{size_mb:.0f} MB")

    total = time.time() - overall_start
    print(f"\n  Total extraction time: {fmt_time(total)}", flush=True)


def generate_pmtiles() -> None:
    """Convert GeoJSON to PMTiles using tippecanoe."""
    result = subprocess.run(
        ["tippecanoe", "--version"], capture_output=True, text=True
    )
    if result.returncode != 0:
        print("ERROR: tippecanoe not found.", file=sys.stderr)
        sys.exit(1)

    t = step(f"Running tippecanoe → {PMTILES_PATH.name} (may take 5–15 min) …")

    cmd = [
        "tippecanoe",
        "--output", str(PMTILES_PATH),
        "--layer", LAYER_NAME,
        "--minimum-zoom", "10",
        "--maximum-zoom", "18",
        "--drop-smallest-as-needed",
        "--simplification=4",
        "--force",
        str(GEOJSON_PATH),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: tippecanoe failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    size_mb = PMTILES_PATH.stat().st_size / 1e6
    done(t, f"{size_mb:.0f} MB")

    if result.stderr:
        lines = [l for l in result.stderr.strip().splitlines() if l]
        for line in lines[-5:]:
            print(f"    {line}")


def main() -> None:
    if not SOURCE_GDB.exists():
        print(f"ERROR: Source GDB not found at:\n  {SOURCE_GDB}", file=sys.stderr)
        sys.exit(1)

    print(f"Source: {SOURCE_GDB}")
    print(f"Output: {PMTILES_PATH}")

    extract_canopy_change()
    generate_pmtiles()

    # Clean up intermediate GeoJSON (very large)
    if GEOJSON_PATH.exists():
        size_mb = GEOJSON_PATH.stat().st_size / 1e6
        print(f"\nRemoving intermediate GeoJSON ({size_mb:.0f} MB) …")
        GEOJSON_PATH.unlink()
        print("  ✓ Removed")

    print(f"\nDone. PMTiles file: {PMTILES_PATH}")


if __name__ == "__main__":
    main()
