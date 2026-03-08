"""
01_extract_boundary_layers.py

Extracts administrative boundary layers from the Allegheny County tree canopy
GDB and computes two canopy loss metrics per feature for web visualization.

The source GDB layers already contain pre-computed canopy statistics (gain,
loss, no-change acreages) from the 2015-2020 tree canopy change survey.
This script selects the relevant fields, derives the two loss metrics, and
exports each layer as WGS84 GeoJSON for the web app.

Output metrics (see PROJECT-OVERVIEW.md for definitions):
  loss_pct_of_area         – Gross loss / land area × 100
  loss_pct_of_2015_canopy  – Gross loss / 2015 canopy area × 100
  net_change_acres         – Gain - Loss (positive = net gain)
  net_pct_of_area          – Net change / land area × 100
  net_pct_of_2015_canopy   – Net change / 2015 canopy area × 100

Usage:
  python3 scripts/01_extract_boundary_layers.py

Outputs written to: output/boundary_layers/
  neighborhoods.geojson
  parks_municipal.geojson
  parks_county.geojson
  city_council_districts.geojson
  county_council_districts.geojson
  municipalities.geojson
"""

import geopandas as gpd
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration – edit these paths if your source data is elsewhere
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

SOURCE_GDB = REPO_ROOT / "source-gis-data" / "TreeCanopyChange_2015_2020_AlleghenyCounty.gdb"

OUTPUT_DIR = REPO_ROOT / "data-pipeline" / "output" / "boundary_layers"

TARGET_CRS = "EPSG:4326"  # WGS84 – required for web map / GeoJSON

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def compute_canopy_metrics(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Add the two standard loss percentage columns to a GeoDataFrame.

    Expects columns: land_area_acres, canopy_2015_acres, loss_acres.
    Adds:
      loss_pct_of_area         – Method 1
      loss_pct_of_2015_canopy  – Method 2
    """
    # Method 1: loss as % of total land area
    gdf["loss_pct_of_area"] = (
        gdf["loss_acres"] / gdf["land_area_acres"] * 100
    ).round(4)

    # Method 2: loss as % of 2015 canopy baseline
    # Guard against divide-by-zero on features with no 2015 canopy
    gdf["loss_pct_of_2015_canopy"] = gdf.apply(
        lambda r: round(r["loss_acres"] / r["canopy_2015_acres"] * 100, 4)
        if r["canopy_2015_acres"] > 0
        else 0.0,
        axis=1,
    )

    # Net change metrics (positive = net gain, negative = net loss)
    gdf["net_change_acres"] = (gdf["gain_acres"] - gdf["loss_acres"]).round(4)

    gdf["net_pct_of_area"] = (
        gdf["net_change_acres"] / gdf["land_area_acres"] * 100
    ).round(4)

    gdf["net_pct_of_2015_canopy"] = gdf.apply(
        lambda r: round(r["net_change_acres"] / r["canopy_2015_acres"] * 100, 4)
        if r["canopy_2015_acres"] > 0
        else 0.0,
        axis=1,
    )

    return gdf


def export_geojson(gdf: gpd.GeoDataFrame, path: Path, label: str) -> None:
    """Reproject to WGS84 and write GeoJSON."""
    gdf = gdf.to_crs(TARGET_CRS)
    gdf.to_file(path, driver="GeoJSON")
    print(f"  ✓ {label}: {len(gdf)} features → {path.name}")


# ---------------------------------------------------------------------------
# Layer processors
# ---------------------------------------------------------------------------


def process_neighborhoods() -> None:
    """
    Pittsburgh_Neighborhoods (90 features).
    This layer has full pre-computed canopy stats including explicit
    TreeCanopy_2015_Acres and TreeCanopy_2020_Acres fields.
    """
    print("Processing Pittsburgh_Neighborhoods …")
    gdf = gpd.read_file(SOURCE_GDB, layer="Pittsburgh_Neighborhoods")

    out = gdf[["hood", "hood_no", "Land_Acres",
               "No_Change_Acres", "Gain_Acres", "Loss_Acres",
               "TreeCanopy_2015_Acres", "TreeCanopy_2020_Acres",
               "geometry"]].copy()

    out = out.rename(columns={
        "hood":                  "name",
        "hood_no":               "neighborhood_id",
        "Land_Acres":            "land_area_acres",
        "No_Change_Acres":       "no_change_acres",
        "Gain_Acres":            "gain_acres",
        "Loss_Acres":            "loss_acres",
        "TreeCanopy_2015_Acres": "canopy_2015_acres",
        "TreeCanopy_2020_Acres": "canopy_2020_acres",
    })

    out = compute_canopy_metrics(out)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    export_geojson(out, OUTPUT_DIR / "neighborhoods.geojson", "Neighborhoods")


def process_parks_municipal() -> None:
    """
    Parks_Municipal (215 features – Pittsburgh city parks).
    Has full pre-computed canopy stats.
    """
    print("Processing Parks_Municipal …")
    gdf = gpd.read_file(SOURCE_GDB, layer="Parks_Municipal")

    # Use the updated/canonical park name; fall back to original if blank
    gdf["park_name"] = gdf["updatepknm"].where(
        gdf["updatepknm"].str.strip() != "", gdf["origpkname"]
    )

    out = gdf[["park_name", "Land_Acres",
               "No_Change_Acres", "Gain_Acres", "Loss_Acres",
               "TreeCanopy_2015_Acres", "TreeCanopy_2020_Acres",
               "geometry"]].copy()

    out = out.rename(columns={
        "park_name":             "name",
        "Land_Acres":            "land_area_acres",
        "No_Change_Acres":       "no_change_acres",
        "Gain_Acres":            "gain_acres",
        "Loss_Acres":            "loss_acres",
        "TreeCanopy_2015_Acres": "canopy_2015_acres",
        "TreeCanopy_2020_Acres": "canopy_2020_acres",
    })

    out = compute_canopy_metrics(out)
    export_geojson(out, OUTPUT_DIR / "parks_municipal.geojson", "Parks (Municipal)")


def process_parks_county() -> None:
    """
    Parks_County (9 features – Allegheny County regional parks).
    Has gain/loss/no-change acreages but not explicit 2015/2020 fields.
    2015 canopy is derived as: No_Change_Acres + Loss_Acres.
    """
    print("Processing Parks_County …")
    gdf = gpd.read_file(SOURCE_GDB, layer="Parks_County")

    out = gdf[["NAME", "Land_Acres",
               "No_Change_Acres", "Gain_Acres", "Loss_Acres",
               "geometry"]].copy()

    out = out.rename(columns={
        "NAME":            "name",
        "Land_Acres":      "land_area_acres",
        "No_Change_Acres": "no_change_acres",
        "Gain_Acres":      "gain_acres",
        "Loss_Acres":      "loss_acres",
    })

    # Derive 2015 and 2020 canopy from gain/loss/no-change components
    out["canopy_2015_acres"] = out["no_change_acres"] + out["loss_acres"]
    out["canopy_2020_acres"] = out["no_change_acres"] + out["gain_acres"]

    out = compute_canopy_metrics(out)
    export_geojson(out, OUTPUT_DIR / "parks_county.geojson", "Parks (County)")


def process_city_council() -> None:
    """
    City_Council_Districts (9 features).
    Only contains a district number; name is constructed as 'District N'.
    2015/2020 canopy derived from gain/loss/no-change components.
    """
    print("Processing City_Council_Districts …")
    gdf = gpd.read_file(SOURCE_GDB, layer="City_Council_Districts")

    out = gdf[["council", "Land_Acres",
               "No_Change_Acres", "Gain_Acres", "Loss_Acres",
               "geometry"]].copy()

    out["name"] = "District " + out["council"].astype(str)

    out = out.rename(columns={
        "Land_Acres":      "land_area_acres",
        "No_Change_Acres": "no_change_acres",
        "Gain_Acres":      "gain_acres",
        "Loss_Acres":      "loss_acres",
    })

    out["district_number"] = out["council"]
    out = out.drop(columns=["council"])

    out["canopy_2015_acres"] = out["no_change_acres"] + out["loss_acres"]
    out["canopy_2020_acres"] = out["no_change_acres"] + out["gain_acres"]

    out = compute_canopy_metrics(out)
    export_geojson(
        out, OUTPUT_DIR / "city_council_districts.geojson", "City Council Districts"
    )


def process_county_council() -> None:
    """
    County_Council_Districts (13 features – Allegheny County).
    LABEL field contains 'District N'; CouncilRep has the representative's name.
    2015/2020 canopy derived from gain/loss/no-change components.
    """
    print("Processing County_Council_Districts …")
    gdf = gpd.read_file(SOURCE_GDB, layer="County_Council_Districts")

    out = gdf[["LABEL", "District", "CouncilRep", "Land_Acres",
               "No_Change_Acres", "Gain_Acres", "Loss_Acres",
               "geometry"]].copy()

    out = out.rename(columns={
        "LABEL":           "name",
        "District":        "district_number",
        "CouncilRep":      "council_rep",
        "Land_Acres":      "land_area_acres",
        "No_Change_Acres": "no_change_acres",
        "Gain_Acres":      "gain_acres",
        "Loss_Acres":      "loss_acres",
    })

    out["canopy_2015_acres"] = out["no_change_acres"] + out["loss_acres"]
    out["canopy_2020_acres"] = out["no_change_acres"] + out["gain_acres"]

    out = compute_canopy_metrics(out)
    export_geojson(
        out, OUTPUT_DIR / "county_council_districts.geojson", "County Council Districts"
    )


def process_municipalities() -> None:
    """
    Municipal_Boundaries_2020 (130 features – all Allegheny County municipalities).
    Has full pre-computed canopy stats including explicit 2015/2020 fields.
    LABEL field has proper-cased name with type (e.g. "Sewickley Borough").
    """
    print("Processing Municipal_Boundaries_2020 …")
    gdf = gpd.read_file(SOURCE_GDB, layer="Municipal_Boundaries_2020")

    out = gdf[["LABEL", "NAME", "TYPE", "Land_Acres",
               "No_Change_Acres", "Gain_Acres", "Loss_Acres",
               "TreeCanopy_2015_Acres", "TreeCanopy_2020_Acres",
               "geometry"]].copy()

    out = out.rename(columns={
        "LABEL":                 "name",
        "NAME":                  "municipality_name",
        "TYPE":                  "municipality_type",
        "Land_Acres":            "land_area_acres",
        "No_Change_Acres":       "no_change_acres",
        "Gain_Acres":            "gain_acres",
        "Loss_Acres":            "loss_acres",
        "TreeCanopy_2015_Acres": "canopy_2015_acres",
        "TreeCanopy_2020_Acres": "canopy_2020_acres",
    })

    out = compute_canopy_metrics(out)
    export_geojson(out, OUTPUT_DIR / "municipalities.geojson", "Municipalities")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    if not SOURCE_GDB.exists():
        print(f"ERROR: Source GDB not found at:\n  {SOURCE_GDB}", file=sys.stderr)
        print("Ensure source-gis-data/ is present in the repository root.", file=sys.stderr)
        sys.exit(1)

    print(f"Source: {SOURCE_GDB}")
    print(f"Output: {OUTPUT_DIR}\n")

    process_neighborhoods()
    process_parks_municipal()
    process_parks_county()
    process_city_council()
    process_county_council()
    process_municipalities()

    print("\nDone. All boundary GeoJSON files written to output/boundary_layers/")
    print("Open in QGIS: Layer > Add Layer > Add Vector Layer, then select any .geojson file.")


if __name__ == "__main__":
    main()
