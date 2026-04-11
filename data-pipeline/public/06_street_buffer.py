"""
06_street_buffer.py

Creates a 50-foot buffer around Allegheny County street centerlines.

The PASDA street centerlines are in EPSG:2272 (PA South State Plane, US
survey feet), so the 50 ft buffer is applied directly without reprojection.

For initial validation, a Pittsburgh-area bbox filter is applied to match
the precomputed pipeline's coverage. Remove the filter for county-wide.

Outputs:
  street_segments_buffered.gpkg  – segment buffer polygons (EPSG:2272)
  street_centerlines.geojson     – centerlines with FULL_NAME (WGS84)

Usage:
  python3 data-pipeline/public/06_street_buffer.py

Outputs written to: data-pipeline/output_public/streets/
"""

import geopandas as gpd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import STREETS, OUTPUT_DIR, CRS_COMPUTE, CRS_WEB, BUFFER_FEET, PUBLIC_GIS_DATA

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

STREETS_OUTPUT_DIR = OUTPUT_DIR / "streets"

STREETS_SHP = STREETS["download_dir"] / STREETS["shapefile_name"]

# Pittsburgh bounding box in EPSG:2272 (US survey feet)
# Used to filter to Pittsburgh-area streets for initial validation.
# Comment out / set to None for county-wide processing.
PITTSBURGH_BBOX_2272 = (1320000, 385000, 1380000, 435000)  # approx Pittsburgh extents


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not STREETS_SHP.exists():
        print(f"ERROR: Streets shapefile not found:\n  {STREETS_SHP}", file=sys.stderr)
        sys.exit(1)

    STREETS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load street centerlines
    print("Loading Allegheny County street centerlines ...")
    roads = gpd.read_file(STREETS_SHP)
    print(f"  {len(roads):,} segments, CRS: {roads.crs}")
    print(f"  {roads['FULL_NAME'].nunique():,} unique street names")

    # Ensure EPSG:2272
    if roads.crs.to_epsg() != 2272:
        print(f"  Reprojecting to EPSG:2272 ...")
        roads = roads.to_crs(CRS_COMPUTE)

    # Filter to Pittsburgh area (for validation phase)
    if PITTSBURGH_BBOX_2272:
        xmin, ymin, xmax, ymax = PITTSBURGH_BBOX_2272
        print(f"  Filtering to Pittsburgh bbox ...")
        roads = roads.cx[xmin:xmax, ymin:ymax]
        print(f"  {len(roads):,} segments after bbox filter")
        print(f"  {roads['FULL_NAME'].nunique():,} unique street names")

    # Buffer each segment by 50 ft
    print(f"\nBuffering by {BUFFER_FEET} ft ...")
    roads_buffered = roads.copy()
    roads_buffered["geometry"] = roads_buffered.geometry.buffer(
        BUFFER_FEET, cap_style="flat", join_style="mitre"
    )

    # Keep only fields needed downstream
    buffers = roads_buffered[["FULL_NAME", "geometry"]].copy()

    # Save individual segment buffers as GeoPackage (EPSG:2272)
    seg_path = STREETS_OUTPUT_DIR / "street_segments_buffered.gpkg"
    buffers.to_file(seg_path, driver="GPKG")
    print(f"  street_segments_buffered.gpkg ({seg_path.stat().st_size / 1e6:.1f} MB)")

    # Save road centerlines as WGS84 GeoJSON
    centerlines = roads[["FULL_NAME", "geometry"]].copy()
    centerlines = centerlines.to_crs(CRS_WEB)

    cl_path = STREETS_OUTPUT_DIR / "street_centerlines.geojson"
    centerlines.to_file(cl_path, driver="GeoJSON")
    print(f"  street_centerlines.geojson ({cl_path.stat().st_size / 1e6:.1f} MB)")

    print("\nDone. Run script 07 next for street canopy statistics.")


if __name__ == "__main__":
    main()
