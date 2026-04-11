"""
config.py

Central configuration for the public data pipeline. All data source URLs,
field mappings, thresholds, and CRS constants live here.

To add a new boundary layer:      add an entry to BOUNDARY_LAYERS.
To adjust tree-size thresholds:   edit THRESHOLDS.

All URLs point to PASDA (Penn State GIS Data Repository) public downloads.

DATA MODEL — How canopy change is derived from PASDA data
=========================================================
PASDA does not distribute canopy change data with gain/loss/no-change
classification. Instead, it distributes canopy footprints for different
time periods. We derive the change classification by spatial overlay:

  2010-2015 dataset (has proper Change=1/2/3):
    - 2010 canopy footprint = Change=1 (no_change) + Change=3 (loss)
    - 2015 canopy footprint = Change=1 (no_change) + Change=2 (gain)

  2015-2020 dataset (570K features, no classification):
    - 2020 canopy footprint = all polygons

  2015→2020 change (derived by spatial overlay):
    - Loss   = 2015 canopy − 2020 canopy  (in 2015 but not 2020)
    - Gain   = 2020 canopy − 2015 canopy  (in 2020 but not 2015)
    - No chg = 2015 canopy ∩ 2020 canopy  (present in both)

IMPORTANT: For the 2010-2015 dataset, only the "__2020" historic version
on PASDA has proper Change=1/2/3 classification. Newer versions (202301,
202507, etc.) have the Change field set to a constant, which is a PASDA
export issue. We use the __2020 version specifically for this reason.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_GIS_DATA = REPO_ROOT / "public-gis-data"
OUTPUT_DIR = REPO_ROOT / "data-pipeline" / "output_public"

# For temporary validation against precomputed pipeline (removed at cutover)
PRECOMPUTED_OUTPUT_DIR = REPO_ROOT / "data-pipeline" / "output"

# ---------------------------------------------------------------------------
# Coordinate Reference Systems
# ---------------------------------------------------------------------------

CRS_COMPUTE = "EPSG:2272"   # PA South State Plane (US survey feet) – for area/distance
CRS_WEB = "EPSG:4326"       # WGS84 – all web outputs

SQ_FT_PER_ACRE = 43560.0

# ---------------------------------------------------------------------------
# Canopy data sources
#
# Two PASDA downloads are used to derive three canopy time points (2010,
# 2015, 2020) and the 2015→2020 change classification.
# ---------------------------------------------------------------------------

CANOPY_2010_2015 = {
    "url": "https://www.pasda.psu.edu/download/alleghenycounty/historic/AlleghenyCounty_TreeCanopyChange/AlleghenyCounty_TreeCanopyChange_2010_2015__2020.zip",
    "download_dir": PUBLIC_GIS_DATA / "canopy_change",
    "description": "2010-2015 canopy change (only __2020 version has proper Change classification)",
    "change_field": "Change",
    "area_field": "Shape_Area",      # sq ft in EPSG:2272
    "change_codes": {1: "no_change", 2: "gain", 3: "loss"},
    "change_no_change": 1,
    "change_gain": 2,
    "change_loss": 3,
}

CANOPY_2020 = {
    "url": "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_TreeCanopyChange_2015_2020_202601.zip",
    "download_dir": PUBLIC_GIS_DATA / "canopy_change",
    "description": "2020 canopy footprint (labeled as 2015-2020 change but is actually 2020 footprint only)",
    "area_field": "Shape_Area",      # sq ft in EPSG:2272
}

# ---------------------------------------------------------------------------
# Boundary layers
#
# Each entry maps a pipeline output name to its PASDA download + field mapping.
# name_field:   source field to rename as "name" in output
# extra_fields: source→output field name mappings to carry through
#
# CRS notes from inspection:
#   Pittsburgh layers (Neighborhoods, Parks, City Council): EPSG:4326
#   Allegheny County layers (Parks, CntyCouncil, Munibnd, Streets): EPSG:2272
# ---------------------------------------------------------------------------

BOUNDARY_LAYERS = {
    "neighborhoods": {
        "url": "https://www.pasda.psu.edu/download/pittsburghcity/Pittsburgh_Neighborhoods.zip",
        "download_dir": PUBLIC_GIS_DATA / "boundaries",
        "shapefile_name": "Pittsburgh_Neighborhoods.shp",
        "name_field": "hood",
        "extra_fields": {"hood_no": "hood_no"},
        "display_name": "Neighborhoods",
    },
    "parks_municipal": {
        "url": "https://www.pasda.psu.edu/download/pittsburghcity/Pittsburgh_Parks.zip",
        "download_dir": PUBLIC_GIS_DATA / "boundaries",
        "shapefile_name": "Pittsburgh_Parks.shp",
        "name_field": "updatepknm",
        "extra_fields": {"origpkname": "original_name"},
        "display_name": "Municipal Parks",
    },
    "parks_county": {
        "url": "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_Parks202601.zip",
        "download_dir": PUBLIC_GIS_DATA / "boundaries",
        "shapefile_name": "AlleghenyCounty_Parks202601.shp",
        "name_field": "NAME",
        "extra_fields": {},
        "display_name": "County Parks",
    },
    "city_council_districts": {
        "url": "https://www.pasda.psu.edu/download/pittsburghcity/Pittsburgh_City_Council_Districts.zip",
        "download_dir": PUBLIC_GIS_DATA / "boundaries",
        "shapefile_name": "Pittsburgh_City_Council_Districts.shp",
        "name_field": "council",
        "extra_fields": {},
        "display_name": "City Council Districts",
        "name_prefix": "District ",
    },
    "county_council_districts": {
        "url": "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_CntyCouncil2016.zip",
        "download_dir": PUBLIC_GIS_DATA / "boundaries",
        "shapefile_name": "AlleghenyCounty_CntyCouncil2016.shp",
        "name_field": "LABEL",
        "extra_fields": {"District": "district"},
        "display_name": "County Council Districts",
    },
    "municipalities": {
        "url": "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_Munibnd202601.zip",
        "download_dir": PUBLIC_GIS_DATA / "boundaries",
        "shapefile_name": "AlleghenyCounty_Munibnd202601.shp",
        "name_field": "LABEL",
        "extra_fields": {"NAME": "municipality_name", "TYPE": "municipality_type"},
        "display_name": "Municipalities (County-wide)",
    },
}

# ---------------------------------------------------------------------------
# Street centerlines
# ---------------------------------------------------------------------------

STREETS = {
    "url": "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_StreetCenterlines20260316.zip",
    "download_dir": PUBLIC_GIS_DATA / "streets",
    "shapefile_name": "AlleghenyCounty_StreetCenterlines20260316.shp",
    "name_field": "FULL_NAME",
}

# ---------------------------------------------------------------------------
# Hydrology (water areas to subtract from land area calculations)
# ---------------------------------------------------------------------------

HYDROLOGY = {
    "url": "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_HydrologyAreas2016.zip",
    "download_dir": PUBLIC_GIS_DATA / "hydrology",
    "shapefile_name": "AlleghenyCounty_HydrologyAreas2016.shp",
}

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------

THRESHOLDS = {
    "mature_tree_acres": 0.04,   # Single mature tree loss/gain
    "grove_acres": 0.07,         # Grove / 2+ trees
}

BUFFER_FEET = 50

# ---------------------------------------------------------------------------
# Tippecanoe tile settings
# ---------------------------------------------------------------------------

TILE_CONFIGS = {
    "mature_tree_losses": {
        "layer": "mature_tree_losses",
        "min_zoom": 12,
        "max_zoom": 18,
        "simplification": 2,
    },
    "mature_tree_gains": {
        "layer": "mature_tree_gains",
        "min_zoom": 12,
        "max_zoom": 18,
        "simplification": 2,
    },
    "canopy_change_all": {
        "layer": "canopy_change_all",
        "min_zoom": 10,
        "max_zoom": 18,
        "simplification": 4,
    },
}

# ---------------------------------------------------------------------------
# Helper: collect all download URLs for the download script
# ---------------------------------------------------------------------------

def get_all_downloads():
    """Return list of (url, download_dir, label) for all data sources."""
    downloads = []

    downloads.append((
        CANOPY_2010_2015["url"],
        CANOPY_2010_2015["download_dir"],
        "Canopy 2010-2015 (with Change classification)",
    ))
    downloads.append((
        CANOPY_2020["url"],
        CANOPY_2020["download_dir"],
        "Canopy 2020 footprint",
    ))

    for key, cfg in BOUNDARY_LAYERS.items():
        downloads.append((cfg["url"], cfg["download_dir"], f"Boundary: {key}"))

    downloads.append((STREETS["url"], STREETS["download_dir"], "Street centerlines"))
    downloads.append((HYDROLOGY["url"], HYDROLOGY["download_dir"], "Hydrology areas (water)"))

    return downloads
