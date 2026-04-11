"""
07_street_canopy_stats.py

Clips canopy footprints to the street buffer and computes:
  a) Per-boundary "street trees" stats (street_* columns added to boundary GeoJSONs)
  b) Per-street canopy stats (street_stats.geojson)

Uses the 2015 and 2020 canopy footprints and the buffered street segments
from script 06.

Usage:
  python3 data-pipeline/public/07_street_canopy_stats.py

Requires: output from 01 (canopy footprints), 02 (boundaries), 06 (street buffers)
Outputs:
  streets/street_stats.geojson         Per-street canopy stats (WGS84)
  streets/street_buffer_area.geojson   Dissolved buffer union (WGS84)
  streets/canopy_in_street_buffer.geojson  QGIS-only inspection file
  boundary_layers/*.geojson            Updated with street_* columns
"""

import geopandas as gpd
import numpy as np
import pandas as pd
import sys
import time
from pathlib import Path
from shapely.ops import unary_union
from shapely.validation import make_valid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import BOUNDARY_LAYERS, OUTPUT_DIR, CRS_COMPUTE, CRS_WEB, SQ_FT_PER_ACRE

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CANOPY_DIR = OUTPUT_DIR / "canopy_change"
STREETS_DIR = OUTPUT_DIR / "streets"
BOUNDARY_DIR = OUTPUT_DIR / "boundary_layers"

CANOPY_2015_PATH = CANOPY_DIR / "canopy_2015.gpkg"
CANOPY_2020_PATH = CANOPY_DIR / "canopy_2020.gpkg"
SEGMENTS_PATH = STREETS_DIR / "street_segments_buffered.gpkg"

CHUNK_SIZE = 50000


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # ------------------------------------------------------------------
    # Step A: Load data
    # ------------------------------------------------------------------
    print("Loading street segment buffers ...")
    segments = gpd.read_file(SEGMENTS_PATH)
    print(f"  {len(segments):,} segments")

    # Dissolve all buffers into a single union polygon
    print("Dissolving buffer union ...")
    t0 = time.time()
    buffer_union = unary_union(segments.geometry)
    buffer_union = make_valid(buffer_union)
    print(f"  Done ({time.time()-t0:.0f}s)")

    # Save buffer area as GeoJSON (web + QGIS)
    buffer_area_gdf = gpd.GeoDataFrame(geometry=[buffer_union], crs=CRS_COMPUTE)
    buffer_area_gdf["buffer_area_acres"] = buffer_area_gdf.geometry.area / SQ_FT_PER_ACRE

    buffer_web = buffer_area_gdf.to_crs(CRS_WEB)
    buffer_path = STREETS_DIR / "street_buffer_area.geojson"
    buffer_web.to_file(buffer_path, driver="GeoJSON")
    print(f"  street_buffer_area.geojson ({buffer_path.stat().st_size / 1e6:.1f} MB)")

    # ------------------------------------------------------------------
    # Step B: Clip canopy to street buffer
    # ------------------------------------------------------------------
    print("\nLoading 2015 canopy ...")
    canopy_2015 = gpd.read_file(CANOPY_2015_PATH)
    print(f"  {len(canopy_2015):,} features")

    print("Loading 2020 canopy ...")
    canopy_2020 = gpd.read_file(CANOPY_2020_PATH)
    print(f"  {len(canopy_2020):,} features")

    # Clip canopy to buffer union
    print("\nClipping 2015 canopy to street buffer ...")
    t0 = time.time()
    canopy_2015_in_buffer = gpd.clip(canopy_2015, buffer_area_gdf)
    canopy_2015_in_buffer["acres"] = canopy_2015_in_buffer.geometry.area / SQ_FT_PER_ACRE
    print(f"  {len(canopy_2015_in_buffer):,} features ({time.time()-t0:.0f}s)")

    print("Clipping 2020 canopy to street buffer ...")
    t0 = time.time()
    canopy_2020_in_buffer = gpd.clip(canopy_2020, buffer_area_gdf)
    canopy_2020_in_buffer["acres"] = canopy_2020_in_buffer.geometry.area / SQ_FT_PER_ACRE
    print(f"  {len(canopy_2020_in_buffer):,} features ({time.time()-t0:.0f}s)")

    # ------------------------------------------------------------------
    # Step C: Per-street stats
    # ------------------------------------------------------------------
    print("\nComputing per-street stats ...")

    # Dissolve segment buffers by street name
    named_buffers = segments.dissolve(by="FULL_NAME").reset_index()
    named_buffers["buffer_area_acres"] = named_buffers.geometry.area / SQ_FT_PER_ACRE
    named_buffers.sindex  # build spatial index

    print(f"  {len(named_buffers):,} unique streets")

    # For each street, clip canopy and compute stats
    stats_rows = []
    t0 = time.time()

    for i, (idx, street) in enumerate(named_buffers.iterrows()):
        street_geom = street.geometry
        name = street["FULL_NAME"]

        try:
            sg = make_valid(street_geom) if not street_geom.is_valid else street_geom

            # 2015 canopy in this street's buffer
            c15_idx = list(canopy_2015_in_buffer.sindex.intersection(sg.bounds))
            c15_area = 0.0
            if c15_idx:
                for g in canopy_2015_in_buffer.iloc[c15_idx].geometry:
                    inter = g.intersection(sg)
                    if not inter.is_empty:
                        c15_area += inter.area

            # 2020 canopy in this street's buffer
            c20_idx = list(canopy_2020_in_buffer.sindex.intersection(sg.bounds))
            c20_area = 0.0
            if c20_idx:
                for g in canopy_2020_in_buffer.iloc[c20_idx].geometry:
                    inter = g.intersection(sg)
                    if not inter.is_empty:
                        c20_area += inter.area

            c15_acres = c15_area / SQ_FT_PER_ACRE
            c20_acres = c20_area / SQ_FT_PER_ACRE
            nc_acres = min(c15_acres, c20_acres)  # approximate
            loss_acres = max(0, c15_acres - c20_acres)
            gain_acres = max(0, c20_acres - c15_acres)
            buf_acres = street["buffer_area_acres"]

            stats_rows.append({
                "name": name if name and str(name).strip() else " ",
                "buffer_area_acres": round(buf_acres, 4),
                "land_area_acres": round(buf_acres, 4),
                "canopy_2015_acres": round(c15_acres, 4),
                "canopy_2020_acres": round(c20_acres, 4),
                "no_change_acres": round(nc_acres, 4),
                "loss_acres": round(loss_acres, 4),
                "gain_acres": round(gain_acres, 4),
                "net_change_acres": round(gain_acres - loss_acres, 4),
            })
        except Exception as e:
            stats_rows.append({"name": name or " "})

        if (i + 1) % 500 == 0 or i == len(named_buffers) - 1:
            elapsed = time.time() - t0
            print(f"    Street {i+1}/{len(named_buffers)} ({elapsed:.0f}s)")

    stats_df = pd.DataFrame(stats_rows)

    # Compute percentage metrics
    for col in ["loss_pct_of_area", "loss_pct_of_2015_canopy",
                "net_pct_of_area", "net_pct_of_2015_canopy"]:
        stats_df[col] = 0.0

    mask = stats_df["land_area_acres"] > 0
    stats_df.loc[mask, "loss_pct_of_area"] = (
        stats_df.loc[mask, "loss_acres"] / stats_df.loc[mask, "land_area_acres"] * 100
    ).round(4)
    stats_df.loc[mask, "net_pct_of_area"] = (
        stats_df.loc[mask, "net_change_acres"] / stats_df.loc[mask, "land_area_acres"] * 100
    ).round(4)

    mask2 = stats_df["canopy_2015_acres"] > 0
    stats_df.loc[mask2, "loss_pct_of_2015_canopy"] = (
        stats_df.loc[mask2, "loss_acres"] / stats_df.loc[mask2, "canopy_2015_acres"] * 100
    ).round(4)
    stats_df.loc[mask2, "net_pct_of_2015_canopy"] = (
        stats_df.loc[mask2, "net_change_acres"] / stats_df.loc[mask2, "canopy_2015_acres"] * 100
    ).round(4)

    # Dissolve centerlines by name for geometry
    print("\nDissolving centerlines for street_stats geometry ...")
    centerlines = gpd.read_file(STREETS_DIR / "street_centerlines.geojson")
    cl_dissolved = centerlines.dissolve(by="FULL_NAME").reset_index()
    cl_dissolved = cl_dissolved.rename(columns={"FULL_NAME": "name"})

    # Merge stats with centerline geometry
    street_stats = cl_dissolved[["name", "geometry"]].merge(stats_df, on="name", how="left")
    street_stats = gpd.GeoDataFrame(street_stats, crs=CRS_WEB)

    out_path = STREETS_DIR / "street_stats.geojson"
    street_stats.to_file(out_path, driver="GeoJSON")
    print(f"  street_stats.geojson ({out_path.stat().st_size / 1e6:.1f} MB, "
          f"{len(street_stats):,} streets)")

    # ------------------------------------------------------------------
    # Step D: Per-boundary street-tree stats
    # ------------------------------------------------------------------
    print("\nComputing per-boundary street-tree stats ...")

    for layer_key, layer_cfg in BOUNDARY_LAYERS.items():
        geojson_path = BOUNDARY_DIR / f"{layer_key}.geojson"
        if not geojson_path.exists():
            continue

        print(f"\n  {layer_cfg['display_name']} ...")
        boundary = gpd.read_file(geojson_path)
        boundary_proj = boundary.to_crs(CRS_COMPUTE)

        street_stats_cols = {}
        for col in ["no_change_acres", "gain_acres", "loss_acres",
                     "canopy_2015_acres", "canopy_2020_acres"]:
            street_stats_cols[f"street_{col}"] = np.zeros(len(boundary))

        for i, (idx, zone) in enumerate(boundary_proj.iterrows()):
            zg = zone.geometry
            if not zg.is_valid:
                zg = make_valid(zg)

            # 2015 canopy in buffer in zone
            c15_idx = list(canopy_2015_in_buffer.sindex.intersection(zg.bounds))
            c15_area = 0.0
            if c15_idx:
                for g in canopy_2015_in_buffer.iloc[c15_idx].geometry:
                    try:
                        inter = g.intersection(zg)
                        if not inter.is_empty:
                            c15_area += inter.area
                    except Exception:
                        continue

            c20_idx = list(canopy_2020_in_buffer.sindex.intersection(zg.bounds))
            c20_area = 0.0
            if c20_idx:
                for g in canopy_2020_in_buffer.iloc[c20_idx].geometry:
                    try:
                        inter = g.intersection(zg)
                        if not inter.is_empty:
                            c20_area += inter.area
                    except Exception:
                        continue

            c15_ac = c15_area / SQ_FT_PER_ACRE
            c20_ac = c20_area / SQ_FT_PER_ACRE
            nc_ac = min(c15_ac, c20_ac)

            street_stats_cols["street_canopy_2015_acres"][i] = round(c15_ac, 4)
            street_stats_cols["street_canopy_2020_acres"][i] = round(c20_ac, 4)
            street_stats_cols["street_no_change_acres"][i] = round(nc_ac, 4)
            street_stats_cols["street_loss_acres"][i] = round(max(0, c15_ac - c20_ac), 4)
            street_stats_cols["street_gain_acres"][i] = round(max(0, c20_ac - c15_ac), 4)

        # Add to boundary GeoDataFrame
        for col, values in street_stats_cols.items():
            boundary[col] = values

        # Compute street percentage metrics
        boundary["street_net_change_acres"] = (
            boundary["street_gain_acres"] - boundary["street_loss_acres"]
        ).round(4)

        boundary["street_loss_pct_of_area"] = np.where(
            boundary["land_area_acres"] > 0,
            (boundary["street_loss_acres"] / boundary["land_area_acres"] * 100).round(4),
            0.0,
        )
        boundary["street_loss_pct_of_2015_canopy"] = np.where(
            boundary["street_canopy_2015_acres"] > 0,
            (boundary["street_loss_acres"] / boundary["street_canopy_2015_acres"] * 100).round(4),
            0.0,
        )
        boundary["street_net_pct_of_area"] = np.where(
            boundary["land_area_acres"] > 0,
            (boundary["street_net_change_acres"] / boundary["land_area_acres"] * 100).round(4),
            0.0,
        )
        boundary["street_net_pct_of_2015_canopy"] = np.where(
            boundary["street_canopy_2015_acres"] > 0,
            (boundary["street_net_change_acres"] / boundary["street_canopy_2015_acres"] * 100).round(4),
            0.0,
        )

        boundary.to_file(geojson_path, driver="GeoJSON")
        print(f"    Updated {geojson_path.name}")

    print("\nStreet canopy stats complete.")


if __name__ == "__main__":
    main()
