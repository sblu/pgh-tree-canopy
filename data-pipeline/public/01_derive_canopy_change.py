"""
01_derive_canopy_change.py

Derives the 2015→2020 canopy change classification from two PASDA datasets:
  - 2010-2015 canopy change (has proper Change=1/2/3 classification)
  - 2015-2020 dataset (2020 canopy footprint only, no classification)

From the 2010-2015 data:
  - 2015 canopy = Change=1 (no_change) + Change=2 (gain)
  - 2010 canopy = Change=1 (no_change) + Change=3 (loss)

From the 2015-2020 data:
  - 2020 canopy = all polygons

Change is derived by spatial overlay:
  - Loss   = 2015 canopy − 2020 canopy  (present in 2015 but not 2020)
  - Gain   = 2020 canopy − 2015 canopy  (present in 2020 but not 2015)

This script outputs intermediate canopy footprints (GeoPackage, EPSG:2272)
used by later scripts for boundary stats and mature tree extraction.

Usage:
  python3 data-pipeline/public/01_derive_canopy_change.py

Outputs written to: data-pipeline/output_public/canopy_change/
  canopy_2015.gpkg           2015 canopy footprint (EPSG:2272)
  canopy_2020.gpkg           2020 canopy footprint (EPSG:2272)
  canopy_2010.gpkg           2010 canopy footprint (EPSG:2272)
  canopy_loss_2015_2020.gpkg Loss polygons (in 2015 not 2020, EPSG:2272)
  canopy_gain_2015_2020.gpkg Gain polygons (in 2020 not 2015, EPSG:2272)
"""

import geopandas as gpd
import numpy as np
import pandas as pd
import sys
import time
from pathlib import Path

# Add parent so we can import config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import (
    CANOPY_2010_2015, CANOPY_2020, OUTPUT_DIR, PUBLIC_GIS_DATA,
    CRS_COMPUTE, SQ_FT_PER_ACRE,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CANOPY_OUTPUT_DIR = OUTPUT_DIR / "canopy_change"

# Shapefile paths (after extraction by 00_download.py)
CANOPY_2010_2015_SHP = PUBLIC_GIS_DATA / "canopy_change" / "AlleghenyCounty_TreeCanopyChange_2010_2015.shp"
CANOPY_2020_SHP = PUBLIC_GIS_DATA / "canopy_change" / "AlleghenyCounty_TreeCanopyChange_2015_2020_202601.shp"

# Grid cell size for chunked overlay (in CRS units = US survey feet)
# ~10,000 ft ≈ 1.9 miles. County is ~35 miles across → ~18×18 grid = 324 cells.
GRID_CELL_SIZE = 10000


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_grid(bounds, cell_size):
    """Create a grid of bounding boxes covering the given extent."""
    xmin, ymin, xmax, ymax = bounds
    cols = int(np.ceil((xmax - xmin) / cell_size))
    rows = int(np.ceil((ymax - ymin) / cell_size))
    cells = []
    for i in range(cols):
        for j in range(rows):
            x0 = xmin + i * cell_size
            y0 = ymin + j * cell_size
            x1 = min(x0 + cell_size, xmax)
            y1 = min(y0 + cell_size, ymax)
            cells.append((x0, y0, x1, y1))
    return cells


def chunked_difference(gdf_a, gdf_b, grid_cells, label=""):
    """Compute A - B (areas in A not in B) using spatial grid chunking."""
    from shapely.ops import unary_union
    from shapely import box

    results = []
    total = len(grid_cells)
    t0 = time.time()

    for idx, (x0, y0, x1, y1) in enumerate(grid_cells):
        cell_box = box(x0, y0, x1, y1)

        # Filter to polygons intersecting this cell
        a_in_cell = gdf_a.cx[x0:x1, y0:y1]
        b_in_cell = gdf_b.cx[x0:x1, y0:y1]

        if len(a_in_cell) == 0:
            continue

        if len(b_in_cell) == 0:
            # All of A in this cell is in the difference
            clipped = gpd.clip(a_in_cell, cell_box)
            if len(clipped) > 0:
                results.append(clipped)
            continue

        # Dissolve B in cell, compute difference
        try:
            b_union = unary_union(b_in_cell.geometry)
            diff_geoms = a_in_cell.geometry.difference(b_union)
            # Filter out empty geometries
            valid = diff_geoms[~diff_geoms.is_empty]
            if len(valid) > 0:
                diff_gdf = gpd.GeoDataFrame(geometry=valid, crs=gdf_a.crs)
                # Clip to cell bounds to avoid double-counting
                clipped = gpd.clip(diff_gdf, cell_box)
                if len(clipped) > 0:
                    results.append(clipped)
        except Exception as e:
            print(f"    Warning: cell {idx} failed: {e}")

        if (idx + 1) % 50 == 0 or idx == total - 1:
            elapsed = time.time() - t0
            pct = (idx + 1) / total * 100
            print(f"    {label} {idx+1}/{total} cells ({pct:.0f}%) "
                  f"[{elapsed:.0f}s elapsed]")

    if results:
        return gpd.GeoDataFrame(
            pd.concat(results, ignore_index=True), crs=gdf_a.crs
        )
    return gpd.GeoDataFrame(geometry=[], crs=gdf_a.crs)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    CANOPY_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------------
    # Step 1: Extract 2015 and 2010 canopy footprints from 2010-2015 data
    # -----------------------------------------------------------------------
    canopy_2015_path = CANOPY_OUTPUT_DIR / "canopy_2015.gpkg"
    canopy_2010_path = CANOPY_OUTPUT_DIR / "canopy_2010.gpkg"

    if canopy_2015_path.exists() and canopy_2010_path.exists():
        print("Step 1: [skip] 2015 and 2010 canopy footprints already exist")
    else:
        print("Step 1: Loading 2010-2015 canopy change data ...")
        t0 = time.time()
        gdf_2010_2015 = gpd.read_file(CANOPY_2010_2015_SHP)
        print(f"  Loaded {len(gdf_2010_2015):,} features in {time.time()-t0:.0f}s")
        print(f"  CRS: {gdf_2010_2015.crs}")
        print(f"  Change values: {gdf_2010_2015['Change'].value_counts().sort_index().to_dict()}")

        # Ensure EPSG:2272 for area calculations
        if gdf_2010_2015.crs.to_epsg() != 2272:
            print("  Reprojecting to EPSG:2272 ...")
            gdf_2010_2015 = gdf_2010_2015.to_crs(CRS_COMPUTE)

        # 2015 canopy = no_change (1) + gain (2)
        print("  Extracting 2015 canopy (Change=1 + Change=2) ...")
        canopy_2015 = gdf_2010_2015[
            gdf_2010_2015["Change"].isin([
                CANOPY_2010_2015["change_no_change"],
                CANOPY_2010_2015["change_gain"],
            ])
        ].copy()
        canopy_2015 = canopy_2015[["geometry"]].copy()
        canopy_2015["acres"] = canopy_2015.geometry.area / SQ_FT_PER_ACRE
        canopy_2015.to_file(canopy_2015_path, driver="GPKG")
        print(f"  Saved 2015 canopy: {len(canopy_2015):,} features, "
              f"{canopy_2015['acres'].sum():,.1f} acres → {canopy_2015_path.name}")

        # 2010 canopy = no_change (1) + loss (3)
        print("  Extracting 2010 canopy (Change=1 + Change=3) ...")
        canopy_2010 = gdf_2010_2015[
            gdf_2010_2015["Change"].isin([
                CANOPY_2010_2015["change_no_change"],
                CANOPY_2010_2015["change_loss"],
            ])
        ].copy()
        canopy_2010 = canopy_2010[["geometry"]].copy()
        canopy_2010["acres"] = canopy_2010.geometry.area / SQ_FT_PER_ACRE
        canopy_2010.to_file(canopy_2010_path, driver="GPKG")
        print(f"  Saved 2010 canopy: {len(canopy_2010):,} features, "
              f"{canopy_2010['acres'].sum():,.1f} acres → {canopy_2010_path.name}")
        del gdf_2010_2015, canopy_2010

    # -----------------------------------------------------------------------
    # Step 2: Prepare 2020 canopy footprint
    # -----------------------------------------------------------------------
    canopy_2020_path = CANOPY_OUTPUT_DIR / "canopy_2020.gpkg"

    if canopy_2020_path.exists():
        print("\nStep 2: [skip] 2020 canopy footprint already exists")
    else:
        print("\nStep 2: Loading 2020 canopy footprint ...")
        t0 = time.time()
        canopy_2020 = gpd.read_file(CANOPY_2020_SHP)
        print(f"  Loaded {len(canopy_2020):,} features in {time.time()-t0:.0f}s")

        if canopy_2020.crs.to_epsg() != 2272:
            print("  Reprojecting to EPSG:2272 ...")
            canopy_2020 = canopy_2020.to_crs(CRS_COMPUTE)

        canopy_2020 = canopy_2020[["geometry"]].copy()
        canopy_2020["acres"] = canopy_2020.geometry.area / SQ_FT_PER_ACRE
        canopy_2020.to_file(canopy_2020_path, driver="GPKG")
        print(f"  Saved 2020 canopy: {len(canopy_2020):,} features, "
              f"{canopy_2020['acres'].sum():,.1f} acres → {canopy_2020_path.name}")

    # -----------------------------------------------------------------------
    # Step 3: Derive 2015→2020 change via spatial overlay
    # -----------------------------------------------------------------------
    loss_path = CANOPY_OUTPUT_DIR / "canopy_loss_2015_2020.gpkg"
    gain_path = CANOPY_OUTPUT_DIR / "canopy_gain_2015_2020.gpkg"

    if loss_path.exists() and gain_path.exists():
        print("\nStep 3: [skip] Loss and gain GeoPackages already exist")
        print("  Delete them to recompute.")
        return

    print("\nStep 3: Deriving 2015→2020 canopy change ...")
    print("  This is compute-intensive and may take 30-60+ minutes.")

    # Load canopy footprints
    print("  Loading 2015 canopy ...")
    canopy_2015 = gpd.read_file(CANOPY_OUTPUT_DIR / "canopy_2015.gpkg")

    print("  Loading 2020 canopy ...")
    canopy_2020 = gpd.read_file(CANOPY_OUTPUT_DIR / "canopy_2020.gpkg")

    # Build spatial grid for chunked processing
    bounds_2015 = canopy_2015.total_bounds
    bounds_2020 = canopy_2020.total_bounds
    combined_bounds = (
        min(bounds_2015[0], bounds_2020[0]),
        min(bounds_2015[1], bounds_2020[1]),
        max(bounds_2015[2], bounds_2020[2]),
        max(bounds_2015[3], bounds_2020[3]),
    )
    grid_cells = make_grid(combined_bounds, GRID_CELL_SIZE)
    print(f"  Processing grid: {len(grid_cells)} cells "
          f"({GRID_CELL_SIZE} ft cell size)")

    # Build spatial index
    print("  Building spatial indices ...")
    canopy_2015.sindex  # trigger build
    canopy_2020.sindex

    # Loss = 2015 - 2020 (areas that were canopy in 2015 but not 2020)
    print("\n  Computing LOSS (2015 canopy − 2020 canopy) ...")
    t0 = time.time()
    loss = chunked_difference(canopy_2015, canopy_2020, grid_cells, label="Loss")
    # Explode multipolygons and recompute area
    if len(loss) > 0:
        loss = loss.explode(index_parts=False).reset_index(drop=True)
        loss["acres"] = loss.geometry.area / SQ_FT_PER_ACRE
        # Filter out slivers (< 1 sq ft)
        loss = loss[loss.geometry.area > 1.0].reset_index(drop=True)
    print(f"  Loss: {len(loss):,} polygons, {loss['acres'].sum():,.1f} acres "
          f"({time.time()-t0:.0f}s)")

    out_path = CANOPY_OUTPUT_DIR / "canopy_loss_2015_2020.gpkg"
    loss.to_file(out_path, driver="GPKG")
    print(f"  Saved → {out_path.name}")

    # Gain = 2020 - 2015 (areas that are canopy in 2020 but weren't in 2015)
    print("\n  Computing GAIN (2020 canopy − 2015 canopy) ...")
    t0 = time.time()
    gain = chunked_difference(canopy_2020, canopy_2015, grid_cells, label="Gain")
    if len(gain) > 0:
        gain = gain.explode(index_parts=False).reset_index(drop=True)
        gain["acres"] = gain.geometry.area / SQ_FT_PER_ACRE
        gain = gain[gain.geometry.area > 1.0].reset_index(drop=True)
    print(f"  Gain: {len(gain):,} polygons, {gain['acres'].sum():,.1f} acres "
          f"({time.time()-t0:.0f}s)")

    out_path = CANOPY_OUTPUT_DIR / "canopy_gain_2015_2020.gpkg"
    gain.to_file(out_path, driver="GPKG")
    print(f"  Saved → {out_path.name}")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    loss_acres = loss["acres"].sum() if len(loss) > 0 else 0
    gain_acres = gain["acres"].sum() if len(gain) > 0 else 0
    canopy_2015_acres = canopy_2015["acres"].sum()
    canopy_2020_acres = canopy_2020["acres"].sum()
    no_change_acres = canopy_2015_acres - loss_acres

    print("\n" + "=" * 60)
    print("Canopy change summary (2015 → 2020):")
    print(f"  2015 canopy:  {canopy_2015_acres:>12,.1f} acres")
    print(f"  2020 canopy:  {canopy_2020_acres:>12,.1f} acres")
    print(f"  No change:    {no_change_acres:>12,.1f} acres")
    print(f"  Loss:         {loss_acres:>12,.1f} acres  ({len(loss):,} polygons)")
    print(f"  Gain:         {gain_acres:>12,.1f} acres  ({len(gain):,} polygons)")
    print(f"  Net change:   {gain_acres - loss_acres:>+12,.1f} acres")
    print("=" * 60)


if __name__ == "__main__":
    main()
