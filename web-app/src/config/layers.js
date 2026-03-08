/**
 * Central configuration for boundary layers, loss metrics, and colours.
 * The web map reads this file to know which data files to fetch and how
 * to label controls. Adding a new layer only requires adding an entry here.
 */

// ---------------------------------------------------------------------------
// Boundary layers
// ---------------------------------------------------------------------------

export const BOUNDARY_LAYERS = [
  {
    id: 'neighborhoods',
    label: 'Neighborhoods',
    file: '/data/boundary_layers/neighborhoods.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search neighborhoods…',
  },
  {
    id: 'city_council',
    label: 'City Council Districts',
    file: '/data/boundary_layers/city_council_districts.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search council districts…',
  },
  {
    id: 'county_council',
    label: 'County Council Districts',
    file: '/data/boundary_layers/county_council_districts.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search county districts…',
  },
  {
    id: 'parks_municipal',
    label: 'Municipal Parks',
    file: '/data/boundary_layers/parks_municipal.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search municipal parks…',
  },
  {
    id: 'parks_county',
    label: 'County Parks',
    file: '/data/boundary_layers/parks_county.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search county parks…',
  },
]

// ---------------------------------------------------------------------------
// Loss metrics
// ---------------------------------------------------------------------------

export const LOSS_METHODS = [
  {
    id: 'loss_pct_of_area',
    label: '% of land area',
    description: 'Loss ÷ total land area of zone',
  },
  {
    id: 'loss_pct_of_2015_canopy',
    label: '% of 2015 canopy',
    description: 'Loss ÷ 2015 canopy area of zone',
  },
]

// ---------------------------------------------------------------------------
// Colour scale  (ColorBrewer Oranges, 6 steps, light → dark)
// Used for boundary choropleth. Breaks are computed from data quantiles
// so the full colour range is always used regardless of data spread.
// ---------------------------------------------------------------------------

export const CHOROPLETH_COLORS = [
  '#fdd0a2', // 0 – low loss  (visible on white basemap)
  '#fdae6b',
  '#fd8d3c',
  '#f16913',
  '#d94801',
  '#8c2d04', // 5 – highest loss
]

// Street tree buffer area
export const STREET_BUFFER_PATH = '/data/streets/street_buffer_area.geojson'
export const STREET_BUFFER_COLOR = '#2563eb'

// Mature tree loss polygon colours (visible at high zoom)
export const TREE_LOSS_COLORS = {
  tree:  '#e74c3c', // single mature tree  (≥ 0.04 ac)
  grove: '#7b241c', // grove / 2+ trees    (≥ 0.07 ac)
}

// PMTiles source (served from /public/data via symlink)
export const TREE_LOSSES_PMTILES_PATH = '/data/canopy_change/mature_tree_losses.pmtiles'

// MapLibre source-layer name (set in 03_generate_pmtiles.py via --layer flag)
export const TREE_LOSSES_SOURCE_LAYER = 'mature_tree_losses'

// Zoom level at which mature tree loss polygons become visible
export const TREE_LOSSES_MIN_ZOOM = 14
