"""
04_street_buffer.py

Creates a 50-foot buffer around Pittsburgh street centerlines.

The PittsburghRoads source layer is in EPSG:4269 (NAD83 geographic, degrees).
Buffering requires a projected CRS whose linear unit is feet, so the roads
are first reprojected to EPSG:2272 (Pennsylvania South State Plane, US survey
feet) before the 50 ft buffer is applied.

Two outputs are produced:
  street_segments_buffered.gpkg  – individual segment buffer polygons
                                   (EPSG:2272, GeoPackage for QGIS + script 05)
  street_centerlines.geojson     – road centerlines with FULLNAME attribute
                                   (WGS84, for web map display and QGIS)

Script 05 reads street_segments_buffered.gpkg to run the canopy intersection.

Usage:
  python3 scripts/04_street_buffer.py

Outputs written to: output/streets/
"""

import geopandas as gpd
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

ROADS_GDB = REPO_ROOT / "source-gis-data" / "PittsburghRoads" / "p20" / "context.gdb"

OUTPUT_DIR = REPO_ROOT / "data-pipeline" / "output" / "streets"

# Source roads CRS (NAD83 geographic)
SOURCE_CRS = "EPSG:4269"
# Projected CRS for buffering: PA South State Plane, unit = US survey foot
BUFFER_CRS = "EPSG:2272"
# Web output CRS
WEB_CRS = "EPSG:4326"

# Buffer distance in US survey feet (50 ft each side of street centerline)
BUFFER_FEET = 50

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    if not ROADS_GDB.exists():
        print(f"ERROR: Roads GDB not found:\n  {ROADS_GDB}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Step 1: Load road centerlines
    # ------------------------------------------------------------------
    print("Loading PittsburghRoads …")
    roads = gpd.read_file(ROADS_GDB, layer="PittsburghRoads")
    print(f"  {len(roads):,} segments, {roads['FULLNAME'].nunique():,} unique street names")
    print(f"  Source CRS: {roads.crs}")

    # ------------------------------------------------------------------
    # Step 2: Reproject to EPSG:2272 for accurate foot-based buffering
    # ------------------------------------------------------------------
    print(f"\nReprojecting to {BUFFER_CRS} …")
    roads_proj = roads.to_crs(BUFFER_CRS)

    # ------------------------------------------------------------------
    # Step 3: Buffer each segment by 50 ft
    # The buffer distance is in the CRS linear unit (US survey feet).
    # cap_style=2 = flat end caps on line termini (square).
    # join_style=2 = mitered joins at bends.
    # ------------------------------------------------------------------
    print(f"Buffering by {BUFFER_FEET} ft …")
    roads_proj["geometry"] = roads_proj.geometry.buffer(
        BUFFER_FEET, cap_style="flat", join_style="mitre"
    )

    # Keep only fields needed downstream
    buffers = roads_proj[["LINEARID", "FULLNAME", "geometry"]].copy()

    # ------------------------------------------------------------------
    # Step 4: Save individual segment buffers as GeoPackage (EPSG:2272)
    # Kept in projected CRS so script 05 can use geometry.area directly
    # without reprojection. QGIS reads .gpkg natively.
    # ------------------------------------------------------------------
    seg_path = OUTPUT_DIR / "street_segments_buffered.gpkg"
    buffers.to_file(seg_path, driver="GPKG")
    print(f"\n  ✓ street_segments_buffered.gpkg  ({seg_path.stat().st_size / 1e6:.1f} MB)")
    print(f"    {len(buffers):,} features, CRS: {BUFFER_CRS}")
    print(f"    Open in QGIS to inspect 50 ft buffer coverage")

    # ------------------------------------------------------------------
    # Step 5: Save road centerlines as WGS84 GeoJSON (web + QGIS)
    # Include only FULLNAME for the web search feature.
    # ------------------------------------------------------------------
    centerlines = roads[["FULLNAME", "geometry"]].copy()
    centerlines = centerlines.to_crs(WEB_CRS)

    cl_path = OUTPUT_DIR / "street_centerlines.geojson"
    centerlines.to_file(cl_path, driver="GeoJSON")
    print(f"\n  ✓ street_centerlines.geojson  ({cl_path.stat().st_size / 1e6:.1f} MB)")
    print(f"    {len(centerlines):,} features, CRS: {WEB_CRS}")

    print("\nDone. Run script 05 next to compute canopy statistics.")
    print("\nQGIS tip: load street_segments_buffered.gpkg and overlay on")
    print("  the boundary layers to visually verify the 50 ft buffer extent.")


if __name__ == "__main__":
    main()
