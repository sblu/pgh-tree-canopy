"""
04_street_buffer.py

Creates a 50-foot buffer around Allegheny County street centerlines.

The county street centerlines shapefile is already in EPSG:2272 (PA South
State Plane, US survey feet), so the 50 ft buffer is applied directly without
reprojection.

Three outputs are produced:
  street_segments_buffered.gpkg  – individual segment buffer polygons
                                   (EPSG:2272, GeoPackage for QGIS + script 05)
  street_buffer_area.geojson     – dissolved union of all buffers
                                   (WGS84, used by script 06 to tag tree polygons)
  street_centerlines.geojson     – road centerlines with FULLNAME attribute
                                   (WGS84, for web map display and QGIS)

Script 05 reads street_segments_buffered.gpkg to run the canopy intersection.
Script 06 reads street_buffer_area.geojson to tag mature tree polygons.

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

ROADS_SHP = (
    REPO_ROOT / "public-gis-data" / "streets"
    / "AlleghenyCounty_StreetCenterlines20260316.shp"
)

OUTPUT_DIR = REPO_ROOT / "data-pipeline" / "output" / "streets"

# The county shapefile is already in EPSG:2272 (PA South State Plane, US survey feet)
BUFFER_CRS = "EPSG:2272"
# Web output CRS
WEB_CRS = "EPSG:4326"

# Buffer distance in US survey feet (50 ft each side of street centerline)
BUFFER_FEET = 50

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    if not ROADS_SHP.exists():
        print(f"ERROR: Roads shapefile not found:\n  {ROADS_SHP}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Step 1: Load road centerlines
    # ------------------------------------------------------------------
    print("Loading Allegheny County street centerlines …")
    roads = gpd.read_file(ROADS_SHP)
    # Rename FULL_NAME → FULLNAME for consistency with downstream scripts
    roads = roads.rename(columns={"FULL_NAME": "FULLNAME"})
    print(f"  {len(roads):,} segments, {roads['FULLNAME'].nunique():,} unique street names")
    print(f"  CRS: {roads.crs}")

    # ------------------------------------------------------------------
    # Step 2: Verify CRS — shapefile should already be EPSG:2272
    # ------------------------------------------------------------------
    if roads.crs.to_epsg() != 2272:
        print(f"  Reprojecting to {BUFFER_CRS} …")
        roads = roads.to_crs(BUFFER_CRS)
    else:
        print(f"  CRS confirmed: {BUFFER_CRS} (no reprojection needed)")

    # ------------------------------------------------------------------
    # Step 3: Buffer each segment by 50 ft
    # The buffer distance is in the CRS linear unit (US survey feet).
    # cap_style=2 = flat end caps on line termini (square).
    # join_style=2 = mitered joins at bends.
    # ------------------------------------------------------------------
    print(f"\nBuffering by {BUFFER_FEET} ft …")
    buffers = roads[["FULLNAME", "geometry"]].copy()
    buffers["geometry"] = buffers.geometry.buffer(
        BUFFER_FEET, cap_style="flat", join_style="mitre"
    )

    # ------------------------------------------------------------------
    # Step 4: Save individual segment buffers as GeoPackage (EPSG:2272)
    # Kept in projected CRS so script 05 can use geometry.area directly
    # without reprojection. QGIS reads .gpkg natively.
    # ------------------------------------------------------------------
    seg_path = OUTPUT_DIR / "street_segments_buffered.gpkg"
    buffers.to_file(seg_path, driver="GPKG")
    print(f"\n  ✓ street_segments_buffered.gpkg  ({seg_path.stat().st_size / 1e6:.1f} MB)")
    print(f"    {len(buffers):,} features, CRS: {BUFFER_CRS}")

    # ------------------------------------------------------------------
    # Step 5: Save dissolved street buffer area (WGS84 GeoJSON)
    # A single-polygon union of all segment buffers, used by script 06 to
    # tag mature tree loss/gain polygons with in_street_buffer.
    # ------------------------------------------------------------------
    print("\nDissolving all buffers to a single union polygon …")
    union_geom = buffers.dissolve().geometry.iloc[0]
    union_gdf = gpd.GeoDataFrame(geometry=[union_geom], crs=BUFFER_CRS)
    union_wgs = union_gdf.to_crs(WEB_CRS)

    buf_area_path = OUTPUT_DIR / "street_buffer_area.geojson"
    union_wgs.to_file(buf_area_path, driver="GeoJSON")
    print(f"  ✓ street_buffer_area.geojson  ({buf_area_path.stat().st_size / 1e6:.1f} MB)")

    # ------------------------------------------------------------------
    # Step 6: Save road centerlines as WGS84 GeoJSON (web + QGIS)
    # Include only FULLNAME for the web search feature.
    # ------------------------------------------------------------------
    centerlines = roads[["FULLNAME", "geometry"]].copy()
    centerlines = centerlines.to_crs(WEB_CRS)

    cl_path = OUTPUT_DIR / "street_centerlines.geojson"
    centerlines.to_file(cl_path, driver="GeoJSON")
    print(f"\n  ✓ street_centerlines.geojson  ({cl_path.stat().st_size / 1e6:.1f} MB)")
    print(f"    {len(centerlines):,} features, CRS: {WEB_CRS}")

    print("\nDone. Run script 05 next to compute canopy statistics.")
    print("\nQGIS tips:")
    print("  - Load street_segments_buffered.gpkg to inspect 50 ft buffer coverage")
    print("  - Load street_buffer_area.geojson to see the full county street buffer union")


if __name__ == "__main__":
    main()
