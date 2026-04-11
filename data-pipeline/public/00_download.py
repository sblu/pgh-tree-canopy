"""
00_download.py

Downloads all publicly available GIS datasets from PASDA (Penn State GIS Data
Repository) required to build the tree canopy visualization from scratch.

Downloads are extracted to public-gis-data/ subdirectories. If a ZIP file
already exists in the target directory, the download is skipped (delete it
to re-download).

Usage:
  python3 data-pipeline/public/00_download.py

Manual reproduction with curl (run from repo root):
  mkdir -p public-gis-data/{canopy_change,boundaries,streets}

  # Canopy 2010-2015 change data (has proper gain/loss/no-change classification)
  # IMPORTANT: Must use the "__2020" historic version — newer versions lost the
  # Change classification due to a PASDA export issue.
  curl -L -o public-gis-data/canopy_change/AlleghenyCounty_TreeCanopyChange_2010_2015__2020.zip \\
    "https://www.pasda.psu.edu/download/alleghenycounty/historic/AlleghenyCounty_TreeCanopyChange/AlleghenyCounty_TreeCanopyChange_2010_2015__2020.zip"

  # Canopy 2020 footprint (labeled as "2015-2020 change" but is actually 2020 footprint)
  curl -L -o public-gis-data/canopy_change/AlleghenyCounty_TreeCanopyChange_2015_2020_202601.zip \\
    "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_TreeCanopyChange_2015_2020_202601.zip"

  # Boundary layers
  curl -L -o public-gis-data/boundaries/Pittsburgh_Neighborhoods.zip \\
    "https://www.pasda.psu.edu/download/pittsburghcity/Pittsburgh_Neighborhoods.zip"
  curl -L -o public-gis-data/boundaries/Pittsburgh_Parks.zip \\
    "https://www.pasda.psu.edu/download/pittsburghcity/Pittsburgh_Parks.zip"
  curl -L -o public-gis-data/boundaries/AlleghenyCounty_Parks202601.zip \\
    "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_Parks202601.zip"
  curl -L -o public-gis-data/boundaries/Pittsburgh_City_Council_Districts.zip \\
    "https://www.pasda.psu.edu/download/pittsburghcity/Pittsburgh_City_Council_Districts.zip"
  curl -L -o public-gis-data/boundaries/AlleghenyCounty_CntyCouncil2016.zip \\
    "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_CntyCouncil2016.zip"
  curl -L -o public-gis-data/boundaries/AlleghenyCounty_Munibnd202601.zip \\
    "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_Munibnd202601.zip"

  # Street centerlines (Allegheny County-wide)
  curl -L -o public-gis-data/streets/AlleghenyCounty_StreetCenterlines20260316.zip \\
    "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_StreetCenterlines20260316.zip"

  # Hydrology areas (for water subtraction from land area)
  curl -L -o public-gis-data/hydrology/AlleghenyCounty_HydrologyAreas2016.zip \\
    "https://www.pasda.psu.edu/download/alleghenycounty/AlleghenyCounty_HydrologyAreas2016.zip"

  # Then extract each:
  for f in public-gis-data/*/*.zip; do unzip -o "$f" -d "$(dirname "$f")"; done
"""

import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve
from urllib.parse import urlparse

# Add parent so we can import config
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import get_all_downloads

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def download_and_extract(url, dest_dir, label):
    """Download a ZIP from url to dest_dir and extract it. Skip if ZIP exists."""
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = Path(urlparse(url).path).name
    zip_path = dest_dir / filename

    # Download (skip if already present)
    if zip_path.exists():
        print(f"  [skip] {filename} already downloaded")
    else:
        print(f"  Downloading {filename} ...")
        try:
            urlretrieve(url, zip_path, reporthook=_progress_hook)
            print()  # newline after progress
        except Exception as e:
            print(f"\n  [ERROR] Failed to download {filename}: {e}")
            return False

    # Extract
    print(f"  Extracting {filename} ...")
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(dest_dir)
        print(f"  Extracted to {dest_dir}/")
    except zipfile.BadZipFile:
        print(f"  [ERROR] {filename} is not a valid ZIP file. Delete and retry.")
        return False

    return True


def _progress_hook(block_num, block_size, total_size):
    """Print download progress."""
    downloaded = block_num * block_size
    if total_size > 0:
        pct = min(100, downloaded * 100 / total_size)
        mb = downloaded / (1024 * 1024)
        total_mb = total_size / (1024 * 1024)
        print(f"\r  {mb:.1f} / {total_mb:.1f} MB ({pct:.0f}%)", end="", flush=True)
    else:
        mb = downloaded / (1024 * 1024)
        print(f"\r  {mb:.1f} MB downloaded", end="", flush=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    downloads = get_all_downloads()

    print(f"Downloading {len(downloads)} datasets from PASDA ...\n")

    results = []
    for url, dest_dir, label in downloads:
        print(f"[{label}]")
        ok = download_and_extract(url, dest_dir, label)
        results.append((label, ok))
        print()

    # Summary
    print("=" * 60)
    print("Download summary:")
    for label, ok in results:
        status = "OK" if ok else "FAILED"
        print(f"  [{status}] {label}")

    failed = sum(1 for _, ok in results if not ok)
    if failed:
        print(f"\n{failed} download(s) failed. Check URLs and retry.")
        sys.exit(1)
    else:
        print(f"\nAll {len(results)} datasets downloaded and extracted successfully.")


if __name__ == "__main__":
    main()
