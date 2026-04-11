"""
03_compute_boundary_stats.py

Computes canopy statistics for each boundary zone by spatial overlay of
the 2015 and 2020 canopy footprints with each boundary layer.

For each boundary zone, computes:
  - land_area_acres      (from zone polygon geometry)
  - canopy_2015_acres    (2015 footprint ∩ zone)
  - canopy_2020_acres    (2020 footprint ∩ zone)
  - no_change_acres      (2015 ∩ 2020 ∩ zone)
  - loss_acres           (canopy_2015 - no_change)
  - gain_acres           (canopy_2020 - no_change)
  - net_change_acres, loss_pct_of_area, loss_pct_of_2015_canopy, etc.

This is compute-intensive — each boundary layer requires clipping ~500K+
canopy polygons. Uses bbox pre-filtering and chunked processing.

Usage:
  python3 data-pipeline/public/03_compute_boundary_stats.py

Requires: output from 01_derive_canopy_change.py and 02_extract_boundaries.py
Updates:  boundary GeoJSON files in output_public/boundary_layers/ (in-place)
"""

import geopandas as gpd
import pandas as pd
import numpy as np
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import BOUNDARY_LAYERS, OUTPUT_DIR, CRS_COMPUTE, CRS_WEB, SQ_FT_PER_ACRE

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CANOPY_DIR = OUTPUT_DIR / "canopy_change"
BOUNDARY_DIR = OUTPUT_DIR / "boundary_layers"

CANOPY_2015_PATH = CANOPY_DIR / "canopy_2015.gpkg"
CANOPY_2020_PATH = CANOPY_DIR / "canopy_2020.gpkg"

CHUNK_SIZE = 50000  # process canopy in chunks of this many features


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_canopy_metrics(gdf):
    """Add derived percentage metrics to a boundary GeoDataFrame."""
    # Method 1: loss as % of total land area
    gdf["loss_pct_of_area"] = np.where(
        gdf["land_area_acres"] > 0,
        (gdf["loss_acres"] / gdf["land_area_acres"] * 100).round(4),
        0.0,
    )

    # Method 2: loss as % of 2015 canopy baseline
    gdf["loss_pct_of_2015_canopy"] = np.where(
        gdf["canopy_2015_acres"] > 0,
        (gdf["loss_acres"] / gdf["canopy_2015_acres"] * 100).round(4),
        0.0,
    )

    # Net change
    gdf["net_change_acres"] = (gdf["gain_acres"] - gdf["loss_acres"]).round(4)

    gdf["net_pct_of_area"] = np.where(
        gdf["land_area_acres"] > 0,
        (gdf["net_change_acres"] / gdf["land_area_acres"] * 100).round(4),
        0.0,
    )

    gdf["net_pct_of_2015_canopy"] = np.where(
        gdf["canopy_2015_acres"] > 0,
        (gdf["net_change_acres"] / gdf["canopy_2015_acres"] * 100).round(4),
        0.0,
    )

    return gdf


def clip_canopy_to_zone(canopy_gdf, zone_geom, zone_crs):
    """Clip canopy polygons to a single boundary zone, return total acres."""
    from shapely.prepared import prep
    from shapely.validation import make_valid

    # Repair zone geometry if needed
    if not zone_geom.is_valid:
        zone_geom = make_valid(zone_geom)

    prepared = prep(zone_geom)

    # Fast pre-filter with spatial index
    possible_idx = list(canopy_gdf.sindex.intersection(zone_geom.bounds))
    if not possible_idx:
        return 0.0

    candidates = canopy_gdf.iloc[possible_idx]

    # Clip and compute area
    total_area_sqft = 0.0
    for geom in candidates.geometry:
        try:
            if prepared.intersects(geom):
                if not geom.is_valid:
                    geom = make_valid(geom)
                clipped = geom.intersection(zone_geom)
                if not clipped.is_empty:
                    total_area_sqft += clipped.area
        except Exception:
            # Skip individual polygon on topology error
            continue

    return total_area_sqft / SQ_FT_PER_ACRE


def compute_zone_stats(canopy_2015, canopy_2020, boundary_gdf):
    """Compute canopy stats for each zone in a boundary layer."""
    # Ensure everything is in EPSG:2272
    if boundary_gdf.crs.to_epsg() != 2272:
        boundary_gdf = boundary_gdf.to_crs(CRS_COMPUTE)

    n_zones = len(boundary_gdf)
    stats = {
        "canopy_2015_acres": np.zeros(n_zones),
        "canopy_2020_acres": np.zeros(n_zones),
    }

    print(f"  Computing canopy stats for {n_zones} zones ...")
    t0 = time.time()

    for i, (idx, zone) in enumerate(boundary_gdf.iterrows()):
        zone_geom = zone.geometry

        stats["canopy_2015_acres"][i] = clip_canopy_to_zone(
            canopy_2015, zone_geom, CRS_COMPUTE
        )
        stats["canopy_2020_acres"][i] = clip_canopy_to_zone(
            canopy_2020, zone_geom, CRS_COMPUTE
        )

        if (i + 1) % 10 == 0 or i == n_zones - 1:
            elapsed = time.time() - t0
            print(f"    Zone {i+1}/{n_zones} ({elapsed:.0f}s)")

    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Load canopy footprints (in EPSG:2272)
    print("Loading canopy footprints ...")
    t0 = time.time()
    canopy_2015 = gpd.read_file(CANOPY_2015_PATH)
    print(f"  2015 canopy: {len(canopy_2015):,} features ({time.time()-t0:.0f}s)")

    t0 = time.time()
    canopy_2020 = gpd.read_file(CANOPY_2020_PATH)
    print(f"  2020 canopy: {len(canopy_2020):,} features ({time.time()-t0:.0f}s)")

    # Build spatial indices
    print("Building spatial indices ...")
    canopy_2015.sindex
    canopy_2020.sindex

    # Process each boundary layer
    for layer_key, layer_cfg in BOUNDARY_LAYERS.items():
        geojson_path = BOUNDARY_DIR / f"{layer_key}.geojson"
        if not geojson_path.exists():
            print(f"\n[SKIP] {geojson_path.name} not found")
            continue

        print(f"\n{'='*60}")
        print(f"Processing {layer_cfg['display_name']} ({geojson_path.name})")

        # Load boundary layer
        boundary = gpd.read_file(geojson_path)

        # Skip if already has canopy stats
        if "canopy_2015_acres" in boundary.columns and boundary["canopy_2015_acres"].sum() > 0:
            print(f"  [skip] Already has canopy stats. Delete column to recompute.")
            continue

        # Reproject to EPSG:2272 for stats computation
        boundary_proj = boundary.to_crs(CRS_COMPUTE)

        # Compute per-zone canopy stats
        stats = compute_zone_stats(canopy_2015, canopy_2020, boundary_proj)

        # Add stats to boundary GeoDataFrame (in WGS84)
        boundary["canopy_2015_acres"] = np.round(stats["canopy_2015_acres"], 4)
        boundary["canopy_2020_acres"] = np.round(stats["canopy_2020_acres"], 4)

        # Derive change components
        # no_change is estimated as the minimum of 2015 and 2020 canopy
        # (a simplification; exact value would require a third overlay)
        # Actually: no_change = 2015_canopy - loss = 2020_canopy - gain
        # loss = 2015_canopy - (2015 ∩ 2020), gain = 2020_canopy - (2015 ∩ 2020)
        # We don't have the intersection, but we can derive:
        # If 2015 + 2020 - total_canopy_union = no_change
        # Simpler: loss = max(0, 2015 - 2020 + net_gain_in_zone)
        # Actually the cleanest: derive from the two footprints directly
        # no_change ≈ 2015 + 2020 - total_unique_canopy
        # But we'd need total_unique_canopy from a union.
        #
        # Simplification: since loss = 2015 - no_change, gain = 2020 - no_change
        # and no_change = 2015 - loss = 2020 - gain, we need one of (loss, gain, no_change).
        #
        # We compute no_change by clipping the intersection. But that's expensive.
        # For now, estimate: no_change ≈ min(2015, 2020) is a lower bound.
        # Better: no_change = 2015 + 2020 - (2015 ∪ 2020)
        # But we need the union area per zone.
        #
        # Let's compute loss = canopy_2015 - canopy_2020 (net, clamped to >= 0)
        # and gain = canopy_2020 - canopy_2015 (net, clamped to >= 0)
        # This gives NET loss/gain which is what we display.
        #
        # Actually the precomputed pipeline has GROSS loss and GROSS gain
        # (which can both be positive in the same zone). To match that we'd
        # need the intersection. Let me compute it properly.

        # We need no_change_acres to derive gross loss and gain.
        # Compute it by clipping both footprints to each zone and intersecting.
        print("  Computing no-change (intersection) per zone ...")
        no_change = np.zeros(len(boundary))
        boundary_proj2 = boundary.to_crs(CRS_COMPUTE)
        t0 = time.time()

        for i, (idx, zone) in enumerate(boundary_proj2.iterrows()):
            zone_geom = zone.geometry
            # Get 2015 polygons in zone
            idx_2015 = list(canopy_2015.sindex.intersection(zone_geom.bounds))
            idx_2020 = list(canopy_2020.sindex.intersection(zone_geom.bounds))

            if not idx_2015 or not idx_2020:
                no_change[i] = 0.0
                continue

            from shapely.ops import unary_union
            from shapely.validation import make_valid

            # Dissolve each footprint within the zone
            c15 = canopy_2015.iloc[idx_2015]
            c20 = canopy_2020.iloc[idx_2020]

            try:
                z = make_valid(zone_geom) if not zone_geom.is_valid else zone_geom
                union_2015 = make_valid(unary_union(c15.geometry)).intersection(z)
                union_2020 = make_valid(unary_union(c20.geometry)).intersection(z)
                intersection = union_2015.intersection(union_2020)
                no_change[i] = intersection.area / SQ_FT_PER_ACRE
            except Exception as e:
                print(f"    Warning: zone {i} intersection failed: {e}")
                no_change[i] = min(
                    stats["canopy_2015_acres"][i],
                    stats["canopy_2020_acres"][i]
                )

            if (i + 1) % 10 == 0 or i == len(boundary) - 1:
                elapsed = time.time() - t0
                print(f"    Zone {i+1}/{len(boundary)} ({elapsed:.0f}s)")

        boundary["no_change_acres"] = np.round(no_change, 4)
        boundary["loss_acres"] = np.round(
            stats["canopy_2015_acres"] - no_change, 4
        )
        boundary["gain_acres"] = np.round(
            stats["canopy_2020_acres"] - no_change, 4
        )

        # Clamp to >= 0 (rounding can cause tiny negatives)
        boundary["loss_acres"] = boundary["loss_acres"].clip(lower=0)
        boundary["gain_acres"] = boundary["gain_acres"].clip(lower=0)

        # Compute derived metrics
        boundary = compute_canopy_metrics(boundary)

        # Save back to GeoJSON
        boundary.to_file(geojson_path, driver="GeoJSON")
        print(f"  Updated {geojson_path.name} with canopy stats")

        # Print summary
        total_loss = boundary["loss_acres"].sum()
        total_gain = boundary["gain_acres"].sum()
        total_nc = boundary["no_change_acres"].sum()
        print(f"  Summary: no_change={total_nc:,.1f}ac  "
              f"loss={total_loss:,.1f}ac  gain={total_gain:,.1f}ac")

    print("\nAll boundary layers updated with canopy statistics.")


if __name__ == "__main__":
    main()
