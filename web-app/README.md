# Web App

Interactive map built with React, Vite, and MapLibre GL JS.

## Requirements

- Node.js 20+

## Development

```bash
npm install

# Create symlink so the dev server can access pipeline output
ln -s ../../data-pipeline/output public/data

# Set up Google Maps API key (see below)
cp .env.example .env
# Edit .env and add your API key

npm run dev
```

Opens at http://localhost:5173

## Google Maps API Key

The Street View feature uses the Google Maps JavaScript API to show
before/after Street View imagery for tree canopy loss polygons. The app
works without an API key, but the Street View feature will be disabled.

### Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services > Library** and enable these three APIs:
   - **Maps JavaScript API** — loads the Google Maps SDK in the browser
   - **Street View Static API** — fetches Street View panorama images
   - **Geocoding API** — reverse-geocodes panorama locations to street addresses
4. Navigate to **APIs & Services > Credentials**
5. Click **Create Credentials > API key**
6. (Recommended) Click the new key to add restrictions:
   - **Application restrictions:** HTTP referrers — add your domain(s)
     (e.g. `https://yourdomain.com/*`, `http://localhost:5173/*` for dev)
   - **API restrictions:** Restrict to the three APIs listed above

### Adding the Key to the Project

Copy `.env.example` to `.env` and replace the placeholder:

```bash
cp .env.example .env
```

```env
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your-actual-key...
```

The key is loaded via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` in
`src/hooks/useStreetView.js`. The `VITE_` prefix is required by Vite to
expose the variable to client-side code.

**Important:** `.env` is gitignored. Never commit your API key. For
production builds, set the environment variable before running
`npm run build`, or add it to your CI/CD environment.

### Error States

If the API key is missing or misconfigured, the app gracefully degrades:

| Issue | Behavior |
|-------|----------|
| No API key | Street View button shows "API key not configured" |
| API restricted / 403 | Street View button shows "API access denied" |
| Quota exceeded | Street View button shows "Quota exceeded" |
| SDK fails to load | Street View button shows "Street View unavailable" |

The rest of the map (canopy layers, boundaries, search) works fully
without the Google Maps API.

## Production Build

```bash
npm run build
```

Output goes to `dist/`. This is a fully static site — serve `dist/` from
any web server (Apache, nginx, WordPress, etc.).

**Important:** The `public/data/` symlink must point to the pipeline output
before building, or copy the data files directly into `public/data/`.

## Deployment

Upload the contents of `dist/` to any web server directory. The build uses
relative paths (`base: './'` in `vite.config.js`), so the app works from
any subdirectory without configuration changes.

**PMTiles note:** The large PMTiles files (especially `canopy_change_all.pmtiles`
at ~714 MB) are served via HTTP range requests — browsers only download the
tiles visible in the current viewport, not the entire file. Your web server
must support `Range` request headers (Apache, nginx, and most hosting
providers do this by default).

## Architecture

| Directory | Purpose |
|-----------|---------|
| `src/App.jsx` | Top-level state management (active layer, method, toggles) |
| `src/components/MapView.jsx` | MapLibre GL map, all map layers, hover popup |
| `src/components/Sidebar.jsx` | Controls: layer switcher, search, toggles, legend |
| `src/components/InfoPanel.jsx` | Hover popup content (zone statistics table) |
| `src/components/Leaderboard.jsx` | Collapsible ranked list of zones by active metric |
| `src/components/TreePopup.jsx` | Click popup for gain/loss polygons with Street View link |
| `src/utils/streetView.js` | Nearest-street + heading calculation for Street View URLs |
| `src/config/layers.js` | Layer definitions, color scales, PMTiles paths |
| `src/hooks/useLayerData.js` | GeoJSON fetching, quantile breaks, color expressions |

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.x | UI framework |
| react-map-gl | 8.1 | React wrapper for MapLibre GL JS |
| maplibre-gl | 5.x | Map rendering engine |
| pmtiles | 4.x | Protocol handler for PMTiles vector tiles |
| @turf/nearest-point-on-line | 7.x | Find closest point on a street centerline |
| @turf/along | 7.x | Offset camera position along street centerline |
| @turf/bearing | 7.x | Compute heading from street point to polygon centroid |
| @turf/distance | 7.x | Pick offset direction (away from target) |
| vite | 5.x | Build tool and dev server |

## Data Files

The web app expects these files under `public/data/`:

```
data/
├── boundary_layers/
│   ├── neighborhoods.geojson
│   ├── city_council_districts.geojson
│   ├── county_council_districts.geojson
│   ├── parks_municipal.geojson
│   ├── parks_county.geojson
│   └── municipalities.geojson
├── canopy_change/
│   ├── mature_tree_losses.pmtiles
│   ├── mature_tree_gains.pmtiles
│   └── canopy_change_all.pmtiles
└── streets/
    ├── street_stats.geojson
    ├── street_centerlines.geojson
    └── street_buffer_area.geojson
```

These are generated by the data pipeline. See
[`../data-pipeline/README.md`](../data-pipeline/README.md).

## Vite Configuration

The `vite.config.js` sets `target: 'es2022'` for both dev and build.
This is required because maplibre-gl v5 uses ES2022 class fields, and
Vite 5's default esbuild target would incorrectly transform them.

The build uses `base: './'` for portable deployment to any subdirectory.
