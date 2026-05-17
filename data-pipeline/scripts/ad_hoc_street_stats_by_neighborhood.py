"""
ad_hoc_street_stats_by_neighborhood.py

One-off (not part of the numbered pipeline) recipe for computing per-street
canopy gain / loss / net-change statistics restricted to the union of one or
more boundary polygons (typically neighborhoods).

Why this exists
---------------
The published `street_stats.geojson` reports stats for each street's *entire*
50-ft buffer, county-wide. When a street (e.g. BEACON ST, DOUGLAS ST) spans
multiple neighborhoods, the published number includes every segment of that
named street across the county. For neighborhood-scoped analysis you need to
clip each street's buffer to the neighborhood polygon first, then recompute
the canopy intersection. That is what this script does.

Methodology
-----------
1.  Load `street_segments_buffered.gpkg` (50-ft buffers around every road
    segment, produced by `04_street_buffer.py`) and keep only the segments
    whose FULLNAME matches the streets of interest.
2.  Dissolve those segments by FULLNAME so each named street is one polygon.
3.  Load the requested boundary polygons (default: neighborhoods.geojson),
    union them, and clip each per-street polygon to that union. The result
    is each street's buffer area *within the boundary region*.
4.  Load `canopy_in_street_buffer.geojson` — the canopy change polygons
    already clipped to the county-wide street-buffer union by
    `05_street_canopy_stats.py`. Reproject to EPSG:2272 and bbox-filter to
    the boundary region for speed.
5.  Overlay-intersect those canopy polygons with each clipped per-street
    polygon (`how='intersection'`), recomputing area from the clipped
    geometry. Group by FULLNAME and Change code (1=no-change, 2=gain,
    3=loss) and sum.
6.  Derive `canopy_2015_acres = no_change + loss`,
    `canopy_2020_acres = no_change + gain`,
    `net_change_acres = gain - loss`, and the two percentage metrics
    (`net_pct_of_2015_canopy`, `loss_pct_of_2015_canopy`).

Validation
----------
Include at least one "control" street that lies entirely within the boundary
region. Its SH-clipped stats should match the published whole-street stats
in `street_stats.geojson` exactly — confirming the neighborhood-clip step
is a no-op when the full street is already inside the boundary.

All areas are computed in EPSG:2272 (US survey feet) and converted to acres.

Usage
-----
Edit the TARGETS / BOUNDARIES constants below for the streets and
neighborhood (or other boundary-layer) names you want, then:

    python3 data-pipeline/scripts/ad_hoc_street_stats_by_neighborhood.py

Prerequisites: scripts 01, 04, and 05 must have been run so that
`canopy_in_street_buffer.geojson`, `street_segments_buffered.gpkg`, and
the boundary GeoJSONs all exist.

Note on net vs. gross
---------------------
The web map's InfoPanel displays *net* canopy change (gain − loss) under the
heading "Acres lost / % of 2015 canopy". This script prints both gross and
net columns so the caller can use whichever matches what they're comparing
against.
"""

import geopandas as gpd
import pandas as pd
import shapely
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration — edit these for a new ad-hoc run
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

# FULLNAME values from street_segments_buffered.gpkg (all-caps).
# Tip: to find variants, grep the .gpkg for partial matches first.
TARGETS = ["BEACON ST", "DOUGLAS ST", "ALDERSON ST"]

# Boundary layer to clip against, and the polygon names to union together.
# `name` is the field in the boundary GeoJSON used as the display name.
BOUNDARY_LAYER = "neighborhoods.geojson"
BOUNDARY_NAMES = ["Squirrel Hill North", "Squirrel Hill South"]
BOUNDARY_NAME_FIELD = "name"

# ---------------------------------------------------------------------------
# Constants — do not edit
# ---------------------------------------------------------------------------

BUF_CRS = "EPSG:2272"
SQ_FT_PER_ACRE = 43560.0

CHANGE_NO_CHANGE = 1
CHANGE_GAIN = 2
CHANGE_LOSS = 3

STREETS_DIR = REPO_ROOT / "data-pipeline" / "output" / "streets"
BOUNDARY_DIR = REPO_ROOT / "data-pipeline" / "output" / "boundary_layers"


def main() -> None:
    # 1. Filter buffered street segments to the streets of interest
    seg = gpd.read_file(STREETS_DIR / "street_segments_buffered.gpkg")
    seg = seg[seg["FULLNAME"].isin(TARGETS)].copy()
    print(f"Matched {len(seg)} buffered segments across {seg['FULLNAME'].nunique()} streets")
    print(seg.groupby("FULLNAME").size().to_string(), "\n")

    # 2. Dissolve each street's segments into a single polygon
    named = seg.dissolve(by="FULLNAME").reset_index()

    # 3. Load boundary polygons, union them, clip each street's buffer to the union
    boundary = gpd.read_file(BOUNDARY_DIR / BOUNDARY_LAYER).to_crs(BUF_CRS)
    boundary = boundary[boundary[BOUNDARY_NAME_FIELD].isin(BOUNDARY_NAMES)]
    if boundary.empty:
        raise SystemExit(f"No boundaries matched {BOUNDARY_NAMES} in {BOUNDARY_LAYER}")

    region = shapely.union_all(boundary.geometry.values)
    if not shapely.is_valid(region):
        region = shapely.make_valid(region)

    named["geometry"] = named.geometry.apply(lambda g: g.intersection(region))
    named["geometry"] = named.geometry.apply(
        lambda g: shapely.make_valid(g) if not shapely.is_valid(g) else g
    )
    named = named[~named.geometry.is_empty].copy()
    named["buffer_area_acres"] = named.geometry.area / SQ_FT_PER_ACRE

    # 4. Load pre-clipped canopy-in-street-buffer, bbox-filter to the region
    canopy = gpd.read_file(STREETS_DIR / "canopy_in_street_buffer.geojson").to_crs(BUF_CRS)
    minx, miny, maxx, maxy = boundary.total_bounds
    canopy = canopy.cx[minx:maxx, miny:maxy].copy()

    # 5. Overlay-intersect canopy polygons with each clipped per-street polygon
    joined = gpd.overlay(
        canopy[["Change", "geometry"]],
        named[["FULLNAME", "geometry"]],
        how="intersection",
    )
    joined["area_acres"] = joined.geometry.area / SQ_FT_PER_ACRE

    # 6. Aggregate to per-street stats
    pivot = (
        joined.groupby(["FULLNAME", "Change"])["area_acres"]
        .sum()
        .unstack(fill_value=0.0)
        .rename(columns={
            CHANGE_NO_CHANGE: "no_change_acres",
            CHANGE_GAIN: "gain_acres",
            CHANGE_LOSS: "loss_acres",
        })
    )
    for col in ("no_change_acres", "gain_acres", "loss_acres"):
        if col not in pivot.columns:
            pivot[col] = 0.0

    pivot["canopy_2015_acres"] = pivot["no_change_acres"] + pivot["loss_acres"]
    pivot["canopy_2020_acres"] = pivot["no_change_acres"] + pivot["gain_acres"]
    pivot["net_change_acres"] = pivot["gain_acres"] - pivot["loss_acres"]
    pivot = pivot.join(named.set_index("FULLNAME")["buffer_area_acres"])

    pivot["loss_pct_of_2015_canopy"] = (pivot["loss_acres"] / pivot["canopy_2015_acres"] * 100).round(2)
    pivot["net_pct_of_2015_canopy"] = (pivot["net_change_acres"] / pivot["canopy_2015_acres"] * 100).round(2)

    cols = [
        "buffer_area_acres", "canopy_2015_acres", "canopy_2020_acres",
        "gain_acres", "loss_acres", "net_change_acres",
        "loss_pct_of_2015_canopy", "net_pct_of_2015_canopy",
    ]
    print(f"=== Per-street stats within {' + '.join(BOUNDARY_NAMES)} ===")
    print(pivot[cols].round(4).to_string())


if __name__ == "__main__":
    main()
