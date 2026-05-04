"""
08_compute_boundary_exemplar_losses.py

For each boundary in every layer in output/boundary_layers/, picks an
"exemplar" mature loss inside the 50 ft street buffer and bakes its
silhouette + centroid into the boundary's properties. The web app uses
this to render a clickable shape preview at the bottom of every
boundary popup, surfacing the before/after Street View feature.

Selection rule (per boundary):
  Of the mature losses (>= 0.04 acres) that intersect the boundary's
  street-buffer area, pick the **median** by acreage (a typical example;
  the largest tend to be outliers — bulldozed lots, forest patches —
  not the residential street-tree losses we want to feature). If only
  one qualifies, use it. If none qualify, leave all exemplar fields
  null.

Overrides (data-pipeline/config/exemplar_overrides.yaml):
  - blocklist:  exclude specific losses (matched by lat/lng within ~22 m)
  - pin:        force a specific loss for a specific boundary

Inputs:
  output/canopy_change/mature_tree_losses.geojson       (script 02)
  output/streets/street_segments_buffered.gpkg         (script 04)
  output/boundary_layers/*.geojson                      (scripts 01, 05)
  data-pipeline/config/exemplar_overrides.yaml          (optional)

Output: each boundary GeoJSON gets five new properties per feature:
  exemplar_loss_acres            float | null
  exemplar_loss_size_category    "tree" | "grove" | null
  exemplar_loss_centroid_lon     float | null    (WGS84)
  exemplar_loss_centroid_lat     float | null
  exemplar_loss_svg_path         string | null   (100x60 viewBox path)

Usage:
  python3 scripts/08_compute_boundary_exemplar_losses.py
"""

import sys
import time
from pathlib import Path
from typing import Optional

import geopandas as gpd
import pandas as pd
import yaml
from shapely.geometry import MultiPolygon, Polygon

REPO_ROOT = Path(__file__).resolve().parents[2]
BOUNDARY_DIR = REPO_ROOT / "data-pipeline" / "output" / "boundary_layers"
LOSSES_PATH = REPO_ROOT / "data-pipeline" / "output" / "canopy_change" / "mature_tree_losses.geojson"
STREETS_PATH = REPO_ROOT / "data-pipeline" / "output" / "streets" / "street_stats.geojson"
CENTERLINES_PATH = REPO_ROOT / "data-pipeline" / "output" / "streets" / "street_centerlines.geojson"
OVERRIDES_PATH = REPO_ROOT / "data-pipeline" / "config" / "exemplar_overrides.yaml"

WORK_CRS = "EPSG:2272"
WEB_CRS = "EPSG:4326"

SVG_VIEWBOX_W = 100
SVG_VIEWBOX_H = 60
SVG_PADDING = 6

# ~22 m at PA latitudes (1° lat ≈ 111 km, 1° lon ≈ 84 km)
SNAP_TOLERANCE_DEG = 0.0002

# Pittsburgh roads dataset stores names in ALL CAPS ("10TH AVE", "BYP",
# "ALY"). The CTA caption sits inside mixed-case prose so title-case it for
# readability while keeping ordinal suffixes lowercase.
_ORDINAL_SUFFIXES = {"ST", "ND", "RD", "TH"}


def format_street_name(raw: str) -> str:
    if not raw:
        return raw
    out = []
    for word in str(raw).split():
        if (
            len(word) > 2
            and word[:-2].isdigit()
            and word[-2:] in _ORDINAL_SUFFIXES
        ):
            out.append(word[:-2] + word[-2:].lower())
        else:
            out.append(word.capitalize())
    return " ".join(out)


def load_overrides() -> dict:
    if not OVERRIDES_PATH.exists():
        return {"pin": {}, "blocklist": []}
    with OVERRIDES_PATH.open() as f:
        data = yaml.safe_load(f) or {}
    return {
        "pin": data.get("pin") or {},
        "blocklist": data.get("blocklist") or [],
    }


def build_loss_index_for_snap(losses_4326: gpd.GeoDataFrame):
    """Returns a list of (lon, lat, row_index) for snap matching."""
    return list(zip(
        losses_4326["centroid_lon"].tolist(),
        losses_4326["centroid_lat"].tolist(),
        losses_4326.index.tolist(),
    ))


def snap_to_loss(target_lon: float, target_lat: float, snap_index, tolerance_deg: float):
    """Find the closest loss to a (lon, lat) within tolerance. Returns row index or None."""
    best_idx = None
    best_dist_sq = tolerance_deg ** 2
    for lon, lat, idx in snap_index:
        d = (lon - target_lon) ** 2 + (lat - target_lat) ** 2
        if d <= best_dist_sq:
            best_dist_sq = d
            best_idx = idx
    return best_idx


def apply_blocklist(losses: gpd.GeoDataFrame, blocklist: list, snap_index) -> gpd.GeoDataFrame:
    if not blocklist:
        return losses
    blocked_indices = set()
    for entry in blocklist:
        lat = entry.get("centroid_lat")
        lon = entry.get("centroid_lon")
        if lat is None or lon is None:
            print(f"  WARN: blocklist entry missing lat/lon: {entry}", file=sys.stderr)
            continue
        idx = snap_to_loss(lon, lat, snap_index, SNAP_TOLERANCE_DEG)
        if idx is None:
            note = entry.get("note", "")
            print(f"  WARN: blocklist entry at ({lat:.4f}, {lon:.4f}) {note!r} matched no loss within {SNAP_TOLERANCE_DEG}°", file=sys.stderr)
            continue
        blocked_indices.add(idx)
    if blocked_indices:
        print(f"  Blocklist: {len(blocked_indices)} loss(es) excluded")
    return losses.drop(index=list(blocked_indices))


def largest_polygon(geom):
    """Returns the largest sub-polygon for MultiPolygons; geom itself if Polygon."""
    if isinstance(geom, MultiPolygon):
        return max(geom.geoms, key=lambda p: p.area)
    if isinstance(geom, Polygon):
        return geom
    return None


def polygon_to_svg_path(geom_4326) -> Optional[str]:
    """Normalize a Polygon's outer ring into a 100x60 SVG viewBox path string.

    Aspect-preserving scale, centered with SVG_PADDING px padding,
    Y-flipped so larger latitudes appear higher in the SVG.
    """
    poly = largest_polygon(geom_4326)
    if poly is None or poly.is_empty:
        return None
    coords = list(poly.exterior.coords)
    if len(coords) < 4:
        return None
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    rx = maxx - minx
    ry = maxy - miny
    if rx == 0 or ry == 0:
        return None
    target_w = SVG_VIEWBOX_W - 2 * SVG_PADDING
    target_h = SVG_VIEWBOX_H - 2 * SVG_PADDING
    s = min(target_w / rx, target_h / ry)
    out_w = rx * s
    out_h = ry * s
    ox = (SVG_VIEWBOX_W - out_w) / 2
    oy = (SVG_VIEWBOX_H - out_h) / 2
    pts = [
        (
            (x - minx) * s + ox,
            (maxy - y) * s + oy,  # SVG Y is inverted
        )
        for x, y in coords
    ]
    return "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z"


def buffer_geom_for_boundaries(boundary_gdf: gpd.GeoDataFrame, geom_type: str) -> gpd.GeoSeries:
    """Returns a Polygon GeoSeries (in WORK_CRS) representing each boundary's
    in-buffer area. For polygon boundaries, this is the boundary geometry
    itself (intersected with the buffered street area later). For line
    boundaries (streets), buffer the line by 50 ft."""
    if geom_type == "line":
        # 50 ft buffer to match the street buffer width used elsewhere
        return boundary_gdf.geometry.buffer(50.0)
    return boundary_gdf.geometry


def compute_exemplars_for_layer(
    boundary_path: Path,
    losses_2272: gpd.GeoDataFrame,
    losses_4326: gpd.GeoDataFrame,
    nearest_street_by_loss: dict,
    snap_index,
    pins_for_layer: dict,
    layer_id: str,
) -> int:
    """Updates a boundary GeoJSON in place with exemplar_loss_* fields.
    Returns count of features that got a non-null exemplar."""
    print(f"\n  {layer_id} ({boundary_path.name}) …")
    bdf = gpd.read_file(boundary_path)
    print(f"    {len(bdf)} boundary feature(s) loaded")

    if "name" not in bdf.columns:
        print(f"    WARN: no 'name' column; skipping {boundary_path.name}", file=sys.stderr)
        return 0

    # All boundary features start with null exemplar fields
    bdf["exemplar_loss_acres"] = None
    bdf["exemplar_loss_size_category"] = None
    bdf["exemplar_loss_centroid_lon"] = None
    bdf["exemplar_loss_centroid_lat"] = None
    bdf["exemplar_loss_svg_path"] = None
    bdf["exemplar_loss_nearest_street"] = None

    # Reproject boundaries to WORK_CRS for spatial join
    bdf_2272 = bdf.to_crs(WORK_CRS)
    geom_kind = bdf_2272.geom_type.iloc[0].lower()
    is_line = "line" in geom_kind

    # Ensure boundary index is a clean integer range so sjoin's index_right
    # values map cleanly back to row positions.
    bdf_2272 = bdf_2272.reset_index(drop=True)

    if is_line:
        joined_geom = bdf_2272.copy()
        joined_geom["geometry"] = bdf_2272.geometry.buffer(50.0)
    else:
        joined_geom = bdf_2272

    # Spatial join: which losses fall inside which boundary?
    # Keep only loss rows; carry the boundary row index across.
    sjoin = gpd.sjoin(losses_2272, joined_geom[["geometry"]], how="inner", predicate="intersects")
    print(f"    {len(sjoin)} (loss, boundary) intersections")

    # For each boundary row, sort joined losses by acreage desc, pick the 2nd
    # (or only). Pin overrides take precedence.
    n_with_exemplar = 0
    n_pinned = 0
    n_pin_failed = 0
    for b_pos in range(len(bdf_2272)):
        name = bdf_2272.iloc[b_pos].get("name")
        chosen_idx = None

        # 1) Pin override wins if present and resolvable
        pin = pins_for_layer.get(str(name)) if name is not None else None
        if pin:
            pin_lat = pin.get("centroid_lat")
            pin_lon = pin.get("centroid_lon")
            if pin_lat is not None and pin_lon is not None:
                chosen_idx = snap_to_loss(pin_lon, pin_lat, snap_index, SNAP_TOLERANCE_DEG)
                if chosen_idx is not None:
                    n_pinned += 1
                else:
                    print(
                        f"    WARN: pinned exemplar for {layer_id}/{name!r} at "
                        f"({pin_lat:.4f}, {pin_lon:.4f}) matched no loss within "
                        f"{SNAP_TOLERANCE_DEG}° — falling back to auto-select",
                        file=sys.stderr,
                    )
                    n_pin_failed += 1

        # 2) Auto-select: median in-buffer mature loss (or only one).
        #    Sorted ascending, picking index n//2 lands on the middle item
        #    for odd n and the upper middle for even n — a typical, non-
        #    outlier example.
        if chosen_idx is None:
            candidates = sjoin[sjoin["index_right"] == b_pos]
            n_candidates = len(candidates)
            if n_candidates > 0:
                ordered = candidates.sort_values("loss_acres", ascending=True)
                chosen_idx = ordered.index[n_candidates // 2]

        if chosen_idx is None:
            continue

        # Look up the chosen loss in WGS84-space dataframe (which has unflipped
        # geometry) for SVG path normalization.
        loss_4326 = losses_4326.loc[chosen_idx]
        svg_path = polygon_to_svg_path(loss_4326.geometry)
        if svg_path is None:
            continue

        bdf.at[b_pos, "exemplar_loss_acres"] = float(loss_4326["loss_acres"])
        bdf.at[b_pos, "exemplar_loss_size_category"] = str(loss_4326["size_category"])
        bdf.at[b_pos, "exemplar_loss_centroid_lon"] = float(loss_4326["centroid_lon"])
        bdf.at[b_pos, "exemplar_loss_centroid_lat"] = float(loss_4326["centroid_lat"])
        bdf.at[b_pos, "exemplar_loss_svg_path"] = svg_path
        nearest_street = nearest_street_by_loss.get(chosen_idx)
        if nearest_street:
            bdf.at[b_pos, "exemplar_loss_nearest_street"] = str(nearest_street)
        n_with_exemplar += 1

    # Coerce to proper numeric dtypes — without this, columns initialised with
    # `None` stay as object dtype and pyogrio's GeoJSON writer emits the
    # numeric values as strings, which breaks the web app (Google Maps Street
    # View rejects string lat/lng).
    bdf["exemplar_loss_acres"] = pd.to_numeric(bdf["exemplar_loss_acres"], errors="coerce")
    bdf["exemplar_loss_centroid_lon"] = pd.to_numeric(bdf["exemplar_loss_centroid_lon"], errors="coerce")
    bdf["exemplar_loss_centroid_lat"] = pd.to_numeric(bdf["exemplar_loss_centroid_lat"], errors="coerce")

    print(f"    {n_with_exemplar}/{len(bdf)} boundaries got an exemplar"
          f" ({n_pinned} pinned, {n_pin_failed} pin-failed → auto)")
    bdf.to_file(boundary_path, driver="GeoJSON")
    return n_with_exemplar


def main() -> None:
    t0 = time.time()
    print(f"Boundary dir: {BOUNDARY_DIR}")
    print(f"Losses:       {LOSSES_PATH}")
    print(f"Overrides:    {OVERRIDES_PATH}")

    if not LOSSES_PATH.exists():
        print(f"ERROR: mature_tree_losses.geojson not found — run script 02 first", file=sys.stderr)
        sys.exit(1)
    if not BOUNDARY_DIR.exists():
        print(f"ERROR: boundary_layers dir not found — run script 01 first", file=sys.stderr)
        sys.exit(1)

    overrides = load_overrides()
    pin_count = sum(len(v) for v in overrides["pin"].values())
    print(f"\nLoaded overrides: {pin_count} pin(s), {len(overrides['blocklist'])} blocklist entries")

    print(f"\nLoading mature_tree_losses.geojson …")
    losses_4326 = gpd.read_file(LOSSES_PATH)
    print(f"  {len(losses_4326)} loss feature(s)")

    if "in_street_buffer" not in losses_4326.columns:
        print("ERROR: losses missing 'in_street_buffer' field — run script 06 first", file=sys.stderr)
        sys.exit(1)

    losses_4326 = losses_4326[losses_4326["in_street_buffer"] == 1].copy()
    print(f"  {len(losses_4326)} in-buffer loss feature(s) (filter: in_street_buffer == 1)")

    snap_index = build_loss_index_for_snap(losses_4326)
    losses_4326 = apply_blocklist(losses_4326, overrides["blocklist"], snap_index)
    print(f"  {len(losses_4326)} loss feature(s) after blocklist")

    losses_2272 = losses_4326.to_crs(WORK_CRS)
    print(f"  Reprojected losses → {WORK_CRS}")

    nearest_street_by_loss = {}
    if CENTERLINES_PATH.exists():
        print(f"\nComputing nearest street name for each loss …")
        cl = gpd.read_file(CENTERLINES_PATH)
        # Centerlines store the street name in `name` (web-friendly),
        # `FULLNAME` (City of Pittsburgh roads dataset, default pipeline),
        # or `FULL_NAME` (PASDA roads dataset, public pipeline).
        name_col = next((c for c in ("name", "FULLNAME", "FULL_NAME") if c in cl.columns), None)
        if name_col is not None:
            cl_2272 = cl[[name_col, "geometry"]].rename(columns={name_col: "_street_name"}).to_crs(WORK_CRS)
            # 200 ft tolerance: well over the 50 ft buffer width, so every
            # in-buffer loss should snap. Larger losses can have a centroid
            # several feet outside the buffer of the nearest street.
            joined = gpd.sjoin_nearest(
                losses_2272, cl_2272, how="left", max_distance=200.0
            )
            # When multiple centerlines tie, sjoin_nearest can produce
            # duplicate rows per loss; keep the first match per loss index.
            joined = joined[~joined.index.duplicated(keep="first")]
            nearest_street_by_loss = joined["_street_name"].dropna().apply(format_street_name).to_dict()
            matched = len(nearest_street_by_loss)
            print(f"  Matched {matched}/{len(losses_2272)} losses to a street name"
                  f" ({matched/len(losses_2272)*100:.1f}%)")
        else:
            print(f"  WARN: street_centerlines.geojson has no 'name' or 'FULLNAME' column", file=sys.stderr)
    else:
        print(f"  NOTE: street_centerlines.geojson not found — exemplars will not include nearest street", file=sys.stderr)

    layer_files = sorted(BOUNDARY_DIR.glob("*.geojson"))
    if STREETS_PATH.exists():
        layer_files.append(STREETS_PATH)
    else:
        print(f"  NOTE: {STREETS_PATH.name} not found — skipping streets layer", file=sys.stderr)

    print(f"\n{len(layer_files)} boundary layer(s) to update:")

    total_updated = 0
    for path in layer_files:
        # Map filename → layer_id used in pin keys.
        # boundary_layers/<X>.geojson → X
        # streets/street_stats.geojson → "streets" (matches BOUNDARY_LAYERS id)
        layer_id = "streets" if path.name == "street_stats.geojson" else path.stem
        pins_for_layer = overrides["pin"].get(layer_id) or {}
        total_updated += compute_exemplars_for_layer(
            path, losses_2272, losses_4326, nearest_street_by_loss, snap_index, pins_for_layer, layer_id
        )

    elapsed = time.time() - t0
    print(f"\nDone. {total_updated} boundary feature(s) got an exemplar in {elapsed:.1f}s.")


if __name__ == "__main__":
    main()
