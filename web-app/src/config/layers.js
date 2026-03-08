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
    id: 'none',
    label: 'None',
    file: null,
    nameField: null,
    searchPlaceholder: null,
    geometryType: null,
  },
  {
    id: 'neighborhoods',
    label: 'Neighborhoods',
    file: '/data/boundary_layers/neighborhoods.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search neighborhoods…',
    geometryType: 'polygon',
  },
  {
    id: 'city_council',
    label: 'City Council Districts',
    file: '/data/boundary_layers/city_council_districts.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search council districts…',
    geometryType: 'polygon',
  },
  {
    id: 'county_council',
    label: 'County Council Districts',
    file: '/data/boundary_layers/county_council_districts.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search county districts…',
    geometryType: 'polygon',
  },
  {
    id: 'parks_municipal',
    label: 'Municipal Parks',
    file: '/data/boundary_layers/parks_municipal.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search municipal parks…',
    geometryType: 'polygon',
  },
  {
    id: 'parks_county',
    label: 'County Parks',
    file: '/data/boundary_layers/parks_county.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search county parks…',
    geometryType: 'polygon',
  },
  {
    id: 'streets',
    label: 'Streets',
    file: '/data/streets/street_stats.geojson',
    nameField: 'name',
    searchPlaceholder: 'Search streets…',
    geometryType: 'line',
  },
]

// ---------------------------------------------------------------------------
// Loss metrics
// ---------------------------------------------------------------------------

export const COLOR_METHODS = [
  {
    id: 'canopy_2020_pct',
    label: 'Total canopy coverage (2020)',
    description: '2020 canopy ÷ total land area',
    group: 'coverage',
  },
  {
    id: 'net_pct_of_area',
    label: '% of land area',
    description: 'Net change ÷ total land area of zone',
    group: 'net_change',
  },
  {
    id: 'net_pct_of_2015_canopy',
    label: '% of 2015 canopy',
    description: 'Net change ÷ 2015 canopy area of zone',
    group: 'net_change',
  },
]

// ---------------------------------------------------------------------------
// Colour scale  (diverging: green = net gain, red = net loss)
// Breaks are computed from data so the full range is used.
// Index 0 is the most-negative (loss), last index is most-positive (gain).
// ---------------------------------------------------------------------------

export const CHOROPLETH_COLORS = [
  '#b2182b', // strong loss
  '#ef8a62', // moderate loss
  '#fddbc7', // mild loss
  '#d9f0d3', // mild gain
  '#7fbf7b', // moderate gain
  '#1b7837', // strong gain
]

// Diverging red→green scale for canopy coverage percentage
// Breaks are computed from data so the full range of the selected layer is used.
export const COVERAGE_COLORS = [
  '#b2182b', // lowest coverage
  '#ef8a62', // low coverage
  '#fddbc7', // below average
  '#d9f0d3', // above average
  '#7fbf7b', // high coverage
  '#1b7837', // highest coverage
]

// Street tree buffer area
export const STREET_BUFFER_PATH = '/data/streets/street_buffer_area.geojson'
export const STREET_BUFFER_COLOR = '#2563eb'

// Canopy gain polygon colours (visible at high zoom)
export const TREE_GAIN_COLORS = {
  tree:  '#22c55e', // medium gain (≥ 0.04 ac)
  grove: '#15803d', // large gain  (≥ 0.07 ac)
}
export const TREE_GAINS_PMTILES_PATH = '/data/canopy_change/mature_tree_gains.pmtiles'
export const TREE_GAINS_SOURCE_LAYER = 'mature_tree_gains'

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
