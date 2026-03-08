"""
05_street_canopy_stats.py

Intersects the street 50-ft buffer with the tree canopy change dataset to
produce two outputs used by the web map:

  (a) "Street trees only" stats for each boundary zone (neighborhood, park,
      council district). These are added as additional columns to the existing
      boundary layer GeoJSON files produced by script 01, so the web app can
      toggle between full-area and street-trees-only statistics without
      loading a separate file.

  (b) Per-street canopy statistics. Streets with the same FULLNAME (e.g.
      all segments of "Penn Ave") are merged and treated as one unit. The
      output GeoJSON uses the centerline geometry so the web map can draw
      and highlight individual streets, with canopy stats in the attributes
      for search and display.

Intermediate outputs for QGIS inspection:
  canopy_in_street_buffer.geojson  – canopy polygons clipped to street buffer
  street_stats.geojson             – per-street centerlines + canopy stats

Methodology note on street intersections:
  Where two named streets meet, a small canopy polygon at the intersection
  may be attributed to both streets in the per-street statistics. This minor
  double-counting is acceptable for visualisation purposes.

Performance:
  The spatial overlay filters the county-wide 3.3M-polygon canopy dataset
  to the Pittsburgh bounding box (~688K features) before processing.
  Expect 10–30 minutes on a typical workstation.

Usage:
  python3 scripts/05_street_canopy_stats.py
  (Run after scripts 01 and 04)

Outputs written to:
  output/streets/canopy_in_street_buffer.geojson
  output/streets/street_stats.geojson
  output/boundary_layers/*.geojson  (updated in place with street_* columns)
"""

import geopandas as gpd
import pandas as pd
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

CANOPY_GDB   = REPO_ROOT / "source-gis-data" / "TreeCanopyChange_2015_2020_AlleghenyCounty.gdb"
CANOPY_LAYER = "TreeCanopyChange_2015_2020_AlleghenyCounty"

STREETS_DIR  = REPO_ROOT / "data-pipeline" / "output" / "streets"
BOUNDARY_DIR = REPO_ROOT / "data-pipeline" / "output" / "boundary_layers"

BUFFER_CRS = "EPSG:2272"   # projected, US survey feet
WEB_CRS    = "EPSG:4326"

# Conversion: US survey feet² → acres  (1 acre ≈ 43,560.17 US survey ft²)
SQ_FT_PER_ACRE = 43560.0

# Change class codes from the source GDB
CHANGE_NO_CHANGE = 1
CHANGE_GAIN      = 2
CHANGE_LOSS      = 3

# Boundary layer files and the field used as the display name
BOUNDARY_LAYERS = [
    ("neighborhoods.geojson",          "name"),
    ("parks_municipal.geojson",        "name"),
    ("parks_county.geojson",           "name"),
    ("city_council_districts.geojson", "name"),
    ("county_council_districts.geojson", "name"),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def log(msg: str, indent: int = 0) -> None:
    prefix = "  " * indent
    print(f"{prefix}{msg}", flush=True)


def elapsed(start: float) -> str:
    s = time.time() - start
    return f"{s:.0f}s" if s < 60 else f"{s/60:.1f}min"


def acres_from_geometry(gdf: gpd.GeoDataFrame) -> pd.Series:
    """Return a Series of areas in acres, computed from geometry in EPSG:2272."""
    return gdf.geometry.area / SQ_FT_PER_ACRE


def aggregate_canopy_stats(gdf: gpd.GeoDataFrame, group_col: str) -> pd.DataFrame:
    """
    Given a GeoDataFrame of canopy intersection polygons with a Change column
    and computed area_acres column, aggregate to gain/loss/no-change per group.

    Returns a DataFrame indexed by group_col with columns:
      no_change_acres, gain_acres, loss_acres,
      canopy_2015_acres, canopy_2020_acres
    """
    pivot = (
        gdf.groupby([group_col, "Change"])["area_acres"]
        .sum()
        .unstack(fill_value=0.0)
        .rename(columns={
            CHANGE_NO_CHANGE: "no_change_acres",
            CHANGE_GAIN:      "gain_acres",
            CHANGE_LOSS:      "loss_acres",
        })
    )
    # Ensure all three change columns exist even if a class is absent
    for col in ("no_change_acres", "gain_acres", "loss_acres"):
        if col not in pivot.columns:
            pivot[col] = 0.0

    pivot["canopy_2015_acres"] = pivot["no_change_acres"] + pivot["loss_acres"]
    pivot["canopy_2020_acres"] = pivot["no_change_acres"] + pivot["gain_acres"]
    return pivot


def add_loss_pct_columns(
    df: pd.DataFrame,
    loss_col: str,
    canopy_2015_col: str,
    area_col: str,
    prefix: str,
) -> pd.DataFrame:
    """
    Compute Method 1 and Method 2 loss percentages and add as new columns.

    Method 1: loss / total land area × 100
    Method 2: loss / 2015 canopy area × 100
    """
    df[f"{prefix}loss_pct_of_area"] = (
        df[loss_col] / df[area_col] * 100
    ).round(4)

    df[f"{prefix}loss_pct_of_2015_canopy"] = df.apply(
        lambda r: round(r[loss_col] / r[canopy_2015_col] * 100, 4)
        if r[canopy_2015_col] > 0 else 0.0,
        axis=1,
    )
    return df


# ---------------------------------------------------------------------------
# Step A: Compute street buffer union and canopy intersection
# ---------------------------------------------------------------------------


def compute_canopy_in_street_buffer(
    pittsburgh_bounds: tuple,
) -> gpd.GeoDataFrame:
    """
    Load Pittsburgh-area canopy polygons, clip them to the street buffer
    union, and return the clipped GeoDataFrame in EPSG:2272 with an
    added 'area_acres' column.
    """
    # Load individual segment buffers
    log("Loading street segment buffers …", 1)
    seg_buffers = gpd.read_file(STREETS_DIR / "street_segments_buffered.gpkg")
    log(f"{len(seg_buffers):,} segments loaded, CRS: {seg_buffers.crs}", 2)

    # Dissolve all segments into a single union polygon, then simplify its
    # geometry to reduce vertex count before intersection.
    # The dissolved raw union has ~152K vertices; at 5 ft tolerance it drops
    # to ~72K with negligible impact on canopy area accuracy (5 ft ≈ 1.5 m).
    SIMPLIFY_TOLERANCE_FT = 5
    log("Dissolving street buffers to union …", 1)
    t = time.time()
    union_geom = seg_buffers.dissolve().geometry.iloc[0].simplify(SIMPLIFY_TOLERANCE_FT)
    street_union = gpd.GeoDataFrame(geometry=[union_geom], crs=seg_buffers.crs)
    log(f"Done ({elapsed(t)}) — union simplified to {SIMPLIFY_TOLERANCE_FT} ft tolerance", 2)

    # Load Pittsburgh-area canopy change polygons using bbox pre-filter
    log("Loading Pittsburgh-area canopy change polygons (bbox filter) …", 1)
    t = time.time()
    canopy = gpd.read_file(
        CANOPY_GDB,
        layer=CANOPY_LAYER,
        bbox=pittsburgh_bounds,
    )
    canopy = canopy[["Change", "geometry"]].copy()
    log(f"{len(canopy):,} features loaded ({elapsed(t)})", 2)

    # Clip canopy polygons to the street buffer union in chunks.
    # gpd.clip is faster than gpd.overlay for this pattern (one complex mask
    # polygon vs. many input polygons) because it uses a simpler code path.
    # Chunking gives us progress reporting and bounds per-chunk memory use.
    CHUNK_SIZE = 50_000  # → ~14 chunks for 688K features; ~1–2 min each
    n_total  = len(canopy)
    n_chunks = (n_total + CHUNK_SIZE - 1) // CHUNK_SIZE

    log(f"Clipping canopy to street buffer ({n_chunks} chunks of {CHUNK_SIZE:,}) …", 1)

    results = []
    chunk_start = time.time()

    for i in range(n_chunks):
        chunk = canopy.iloc[i * CHUNK_SIZE : (i + 1) * CHUNK_SIZE]
        result = gpd.clip(chunk, street_union)
        results.append(result)

        done        = i + 1
        pct         = done / n_chunks * 100
        elapsed_so_far  = time.time() - chunk_start
        secs_per_chunk  = elapsed_so_far / done
        secs_remaining  = secs_per_chunk * (n_chunks - done)

        # Format remaining time as Xm Ys for readability
        mins, secs = divmod(int(secs_remaining), 60)
        eta_str = f"{mins}m {secs:02d}s remaining" if mins else f"{secs}s remaining"

        log(
            f"chunk {done}/{n_chunks}  ({pct:5.1f}%)  "
            f"elapsed {elapsed(chunk_start)}  ~{eta_str}  "
            f"[{len(result):,} intersected]",
            2,
        )

    canopy_in_streets = gpd.GeoDataFrame(
        pd.concat(results, ignore_index=True),
        geometry="geometry",
        crs=BUFFER_CRS,
    )
    log(f"Total: {len(canopy_in_streets):,} clipped polygons ({elapsed(chunk_start)})", 2)

    # Compute actual intersection area (the source Acres field no longer
    # applies after clipping)
    canopy_in_streets["area_acres"] = acres_from_geometry(canopy_in_streets)

    return canopy_in_streets


# ---------------------------------------------------------------------------
# Step B: Option (a) – boundary zone street-tree stats
# ---------------------------------------------------------------------------


def add_street_stats_to_boundary_layers(
    canopy_in_streets: gpd.GeoDataFrame,
) -> None:
    """
    Spatial-join the street-clipped canopy to each boundary layer and
    aggregate gain/loss/no-change per zone. The resulting street_* columns
    are merged into the existing boundary GeoJSON files.
    """
    log("Computing boundary-zone street-tree statistics …", 1)

    for filename, name_field in BOUNDARY_LAYERS:
        path = BOUNDARY_DIR / filename
        if not path.exists():
            log(f"SKIP: {filename} not found (run script 01 first)", 2)
            continue

        log(f"{filename} …", 2)
        t = time.time()

        # Load boundary layer and reproject to EPSG:2272 for the spatial join
        boundary = gpd.read_file(path).to_crs(BUFFER_CRS)

        # Spatial join: map each canopy piece to the boundary zone it falls in.
        # predicate='within' avoids double-counting polygons that straddle
        # two zones at their shared edge.
        joined = gpd.sjoin(
            canopy_in_streets,
            boundary[[name_field, "land_area_acres", "geometry"]],
            how="left",
            predicate="within",
        )

        # Drop canopy pieces that didn't land inside any zone
        joined = joined.dropna(subset=[name_field])

        # Aggregate to per-zone stats
        stats = aggregate_canopy_stats(joined, name_field)

        # Method 1 uses the total land area of the zone (same denominator as
        # the full-area stats, so the user can compare the two directly).
        # Merge land_area_acres from the boundary layer for the calculation.
        land_area = boundary.set_index(name_field)["land_area_acres"]
        stats = stats.join(land_area)

        stats = add_loss_pct_columns(
            stats,
            loss_col="loss_acres",
            canopy_2015_col="canopy_2015_acres",
            area_col="land_area_acres",
            prefix="street_",
        )
        stats = stats.drop(columns=["land_area_acres"])

        # Rename to street_* prefix for all canopy columns
        stats = stats.rename(columns={
            "no_change_acres":    "street_no_change_acres",
            "gain_acres":         "street_gain_acres",
            "loss_acres":         "street_loss_acres",
            "canopy_2015_acres":  "street_canopy_2015_acres",
            "canopy_2020_acres":  "street_canopy_2020_acres",
        })

        # Merge street stats back into the boundary GeoJSON and re-save
        boundary_wgs = gpd.read_file(path)  # reload in original WGS84
        updated = boundary_wgs.merge(stats, left_on=name_field, right_index=True, how="left")

        # Fill zones with no nearby canopy change (e.g. fully paved areas)
        street_cols = [c for c in updated.columns if c.startswith("street_")]
        updated[street_cols] = updated[street_cols].fillna(0.0)

        # Compute street net change metrics
        updated["street_net_change_acres"] = (
            updated["street_gain_acres"] - updated["street_loss_acres"]
        ).round(4)
        updated["street_net_pct_of_area"] = (
            updated["street_net_change_acres"] / updated["land_area_acres"] * 100
        ).round(4)
        updated["street_net_pct_of_2015_canopy"] = updated.apply(
            lambda r: round(r["street_net_change_acres"] / r["street_canopy_2015_acres"] * 100, 4)
            if r["street_canopy_2015_acres"] > 0 else 0.0,
            axis=1,
        )

        updated.to_file(path, driver="GeoJSON")
        log(f"  ✓ updated ({elapsed(t)})", 2)


# ---------------------------------------------------------------------------
# Step C: Option (b) – per-street stats
# ---------------------------------------------------------------------------


def compute_per_street_stats(
    canopy_in_streets: gpd.GeoDataFrame,
    seg_buffers: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    """
    Aggregate canopy stats per unique street name (FULLNAME).

    Streets with multiple segments (e.g. Penn Ave spanning many blocks) are
    treated as one unit: their individual buffers are dissolved by FULLNAME
    before the spatial join.
    """
    log("Computing per-street canopy statistics …", 1)

    # Dissolve segment buffers by street name → one polygon per FULLNAME
    log("Dissolving segment buffers by FULLNAME …", 2)
    t = time.time()
    named_buffers = seg_buffers.dissolve(by="FULLNAME")[["geometry"]].reset_index()
    log(f"{len(named_buffers):,} unique streets ({elapsed(t)})", 2)

    # Buffer area per street name (used for Method 1 denominator)
    named_buffers["buffer_area_acres"] = acres_from_geometry(named_buffers)

    # Spatial join: map each clipped canopy piece to intersecting streets.
    # A canopy polygon at a 4-way intersection may match multiple street names
    # (minor double-counting; acceptable for visualisation).
    log("Spatial joining canopy to named street buffers …", 2)
    t = time.time()
    joined = gpd.sjoin(
        canopy_in_streets,
        named_buffers[["FULLNAME", "buffer_area_acres", "geometry"]],
        how="left",
        predicate="within",
    )
    joined = joined.dropna(subset=["FULLNAME"])
    log(f"{len(joined):,} canopy-street associations ({elapsed(t)})", 2)

    # Aggregate canopy stats by street name
    stats = aggregate_canopy_stats(joined, "FULLNAME")

    # Merge buffer area for Method 1 denominator
    buf_area = named_buffers.set_index("FULLNAME")["buffer_area_acres"]
    stats = stats.join(buf_area)

    stats = add_loss_pct_columns(
        stats,
        loss_col="loss_acres",
        canopy_2015_col="canopy_2015_acres",
        area_col="buffer_area_acres",
        prefix="",
    )

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    missing = []
    if not CANOPY_GDB.exists():
        missing.append(str(CANOPY_GDB))
    if not (STREETS_DIR / "street_segments_buffered.gpkg").exists():
        missing.append(str(STREETS_DIR / "street_segments_buffered.gpkg"))
    if missing:
        for m in missing:
            print(f"ERROR: missing input: {m}", file=sys.stderr)
        print("Run scripts 01 and 04 before this script.", file=sys.stderr)
        sys.exit(1)

    STREETS_DIR.mkdir(parents=True, exist_ok=True)

    total_start = time.time()
    log(f"Source GDB:   {CANOPY_GDB.name}")
    log(f"Streets dir:  {STREETS_DIR}")
    log(f"Boundary dir: {BOUNDARY_DIR}")
    log("")

    # ------------------------------------------------------------------
    # Get Pittsburgh bounding box from neighborhoods layer (EPSG:2272)
    # to pre-filter the county-wide canopy dataset.
    # ------------------------------------------------------------------
    log("Reading Pittsburgh bounding box …")
    neighborhoods = gpd.read_file(BOUNDARY_DIR / "neighborhoods.geojson").to_crs(BUFFER_CRS)
    pittsburgh_bounds = tuple(neighborhoods.total_bounds)
    log(f"  Bounds (EPSG:2272): {tuple(round(v) for v in pittsburgh_bounds)}", 1)

    # ------------------------------------------------------------------
    # Core intersection: canopy clipped to street buffer union
    # ------------------------------------------------------------------
    log("\n--- Step 1: Canopy × street buffer intersection ---")
    canopy_in_streets = compute_canopy_in_street_buffer(pittsburgh_bounds)

    # Save for QGIS inspection (reproject to WGS84)
    log("\nSaving canopy_in_street_buffer.geojson for QGIS inspection …")
    t = time.time()
    canopy_in_streets.to_crs(WEB_CRS).to_file(
        STREETS_DIR / "canopy_in_street_buffer.geojson", driver="GeoJSON"
    )
    size = (STREETS_DIR / "canopy_in_street_buffer.geojson").stat().st_size / 1e6
    log(f"  ✓ canopy_in_street_buffer.geojson  ({size:.1f} MB, {elapsed(t)})", 1)

    # ------------------------------------------------------------------
    # Option (a): update boundary layers with street-tree stats
    # ------------------------------------------------------------------
    log("\n--- Step 2: Option (a) – boundary zone street-tree stats ---")
    add_street_stats_to_boundary_layers(canopy_in_streets)

    # ------------------------------------------------------------------
    # Option (b): per-street stats + centerline output
    # ------------------------------------------------------------------
    log("\n--- Step 3: Option (b) – per-street canopy stats ---")
    seg_buffers = gpd.read_file(STREETS_DIR / "street_segments_buffered.gpkg")
    street_stats = compute_per_street_stats(canopy_in_streets, seg_buffers)

    # Join stats onto street centerlines (WGS84 geometry for web display)
    log("Joining stats to street centerlines …", 1)
    centerlines = gpd.read_file(STREETS_DIR / "street_centerlines.geojson")

    # Dissolve multi-segment streets into single MultiLineString per name
    centerlines_dissolved = centerlines.dissolve(by="FULLNAME").reset_index()

    # Merge stats
    street_output = centerlines_dissolved.merge(
        street_stats, on="FULLNAME", how="left"
    )

    # Streets with no canopy change data (e.g. fully underground tunnels)
    stat_cols = [c for c in street_stats.columns if c != "FULLNAME"]
    street_output[stat_cols] = street_output[stat_cols].fillna(0.0)

    # Round float columns for clean output
    float_cols = street_output.select_dtypes("float64").columns
    street_output[float_cols] = street_output[float_cols].round(4)

    out_path = STREETS_DIR / "street_stats.geojson"
    street_output.to_file(out_path, driver="GeoJSON")
    size = out_path.stat().st_size / 1e6
    log(f"  ✓ street_stats.geojson  ({size:.1f} MB, {len(street_output):,} streets)", 1)

    log(f"\nAll done in {elapsed(total_start)}.")
    log("")
    log("Outputs:")
    log("  output/streets/canopy_in_street_buffer.geojson  – QGIS inspection")
    log("  output/streets/street_stats.geojson             – web map + QGIS")
    log("  output/boundary_layers/*.geojson                – updated with street_* columns")
    log("")
    log("QGIS tip: categorize canopy_in_street_buffer.geojson by Change field")
    log("  1 = No Change (grey), 2 = Gain (green), 3 = Loss (red)")


if __name__ == "__main__":
    main()
