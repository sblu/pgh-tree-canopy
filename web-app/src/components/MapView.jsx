import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import Map, { Source, Layer, Popup, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'

import TreePopup from './TreePopup'
import {
  CHOROPLETH_COLORS,
  TREE_LOSS_COLORS,
  TREE_LOSSES_PMTILES_PATH,
  TREE_LOSSES_SOURCE_LAYER,
  TREE_LOSSES_MIN_ZOOM,
  TREE_GAIN_COLORS,
  TREE_GAINS_PMTILES_PATH,
  TREE_GAINS_SOURCE_LAYER,
  STREET_BUFFER_COLOR,
  CANOPY_CHANGE_PMTILES_PATH,
  CANOPY_CHANGE_SOURCE_LAYER,
  CANOPY_CHANGE_MIN_ZOOM,
  CANOPY_CHANGE_COLORS,
} from '../config/layers'
import { buildColorExpression } from '../hooks/useLayerData'
import InfoPanel from './InfoPanel'

// Register the pmtiles:// protocol with MapLibre once at module load.
try {
  const pmtilesProtocol = new Protocol()
  maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile.bind(pmtilesProtocol))
} catch (err) {
  console.error('Failed to register pmtiles protocol:', err)
}

// Light CartoDB Positron basemap — free, no API key required
const BASE_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const PITTSBURGH_CENTER = { longitude: -79.9959, latitude: 40.4406, zoom: 11 }

const TREE_LAYER_IDS = ['tree-losses-grove', 'tree-losses-tree', 'tree-gains-grove', 'tree-gains-tree']

export default function MapView({
  layerData,
  activeLayerConfig,
  activeMethodId,
  colorBreaks,
  choroplethColors,
  showTreeLosses,
  showTreeGains,
  showStreetBuffer,
  streetBufferData,
  showCanopyChange,
  selectedFeatureName,
  hoveredFeature,
  onHover,
  onHoverEnd,
  onFeatureClick,
}) {
  const mapRef = useRef(null)
  const [clickedTree, setClickedTree] = useState(null)

  // Build pmtiles:// URL using the current page origin so it works in both
  // dev (localhost:5173) and production (wordpress server)
  const treeLossesUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `pmtiles://${origin}${TREE_LOSSES_PMTILES_PATH}`
  }, [])

  const treeGainsUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `pmtiles://${origin}${TREE_GAINS_PMTILES_PATH}`
  }, [])

  const canopyChangeUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `pmtiles://${origin}${CANOPY_CHANGE_PMTILES_PATH}`
  }, [])

  const isLineLayer = activeLayerConfig?.geometryType === 'line'
  const hoveredName = hoveredFeature?.feature?.properties?.name ?? ''

  // Build list of interactive (clickable/hoverable) layer IDs
  const interactiveLayerIds = useMemo(() => {
    const ids = []
    if (layerData) ids.push(isLineLayer ? 'boundary-line' : 'boundary-fill')
    if (showTreeLosses) ids.push('tree-losses-grove', 'tree-losses-tree')
    if (showTreeGains) ids.push('tree-gains-grove', 'tree-gains-tree')
    return ids
  }, [layerData, isLineLayer, showTreeLosses, showTreeGains])

  // Fill colour expression, recomputed when method or breaks change
  const colors = choroplethColors || CHOROPLETH_COLORS
  const fillColorExpr = useMemo(
    () => buildColorExpression(activeMethodId, colorBreaks, colors),
    [activeMethodId, colorBreaks, colors]
  )

  // Fly to / fit selected feature when search result is chosen
  useEffect(() => {
    if (!selectedFeatureName || !layerData || !mapRef.current) return
    const feature = layerData.features.find(
      f => f.properties?.name === selectedFeatureName
    )
    if (!feature) return

    const map = mapRef.current.getMap()
    const bounds = new maplibregl.LngLatBounds()
    const addCoords = coords => {
      if (typeof coords[0] === 'number') bounds.extend(coords)
      else coords.forEach(addCoords)
    }
    addCoords(feature.geometry.coordinates)
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 })
  }, [selectedFeatureName, layerData])

  const handleMouseMove = useCallback(e => {
    const feature = e.features?.[0]
    if (feature) {
      onHover({ feature, lngLat: e.lngLat })
    } else {
      onHoverEnd()
    }
  }, [onHover, onHoverEnd])

  const handleMouseLeave = useCallback(() => onHoverEnd(), [onHoverEnd])

  const handleClick = useCallback(e => {
    const feature = e.features?.[0]
    if (!feature) {
      setClickedTree(null)
      return
    }
    // If the click hit a tree polygon layer, show Street View popup
    if (TREE_LAYER_IDS.includes(feature.layer?.id)) {
      const isGain = feature.layer.id.startsWith('tree-gains')
      setClickedTree({
        feature,
        lngLat: e.lngLat,
        isGain,
      })
    } else {
      setClickedTree(null)
      onFeatureClick(feature.properties?.name)
    }
  }, [onFeatureClick])

  const handleMapError = useCallback(e => {
    console.error('[MapView] Map error:', e)
  }, [])

  return (
    <Map
      ref={mapRef}
      mapLib={maplibregl}
      mapStyle={BASE_STYLE}
      initialViewState={PITTSBURGH_CENTER}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={interactiveLayerIds}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onError={handleMapError}
      cursor={hoveredFeature ? 'pointer' : 'grab'}
    >
      <NavigationControl position="top-right" />
      <ScaleControl position="bottom-right" unit="imperial" />

      {/* ── Street buffer area (render below boundary so choropleth is on top) */}
      {showStreetBuffer && streetBufferData && (
        <Source id="street-buffer" type="geojson" data={streetBufferData}>
          <Layer
            id="street-buffer-fill"
            type="fill"
            paint={{
              'fill-color': STREET_BUFFER_COLOR,
              'fill-opacity': 0.15,
            }}
          />
          <Layer
            id="street-buffer-outline"
            type="line"
            paint={{
              'line-color': STREET_BUFFER_COLOR,
              'line-width': 0.5,
              'line-opacity': 0.4,
            }}
          />
        </Source>
      )}

      {/* ── Full canopy change layer (3.3M polygons, PMTiles) ──────── */}
      {showCanopyChange && (
        <Source id="canopy-change" type="vector" url={canopyChangeUrl}>
          <Layer
            {...{
              id: 'canopy-no-change',
              type: 'fill',
              'source-layer': CANOPY_CHANGE_SOURCE_LAYER,
              minzoom: CANOPY_CHANGE_MIN_ZOOM,
              filter: ['==', ['get', 'change_class'], 'no_change'],
              paint: {
                'fill-color': CANOPY_CHANGE_COLORS.no_change,
                'fill-opacity': 0.5,
              },
            }}
          />
          <Layer
            {...{
              id: 'canopy-gain',
              type: 'fill',
              'source-layer': CANOPY_CHANGE_SOURCE_LAYER,
              minzoom: CANOPY_CHANGE_MIN_ZOOM,
              filter: ['==', ['get', 'change_class'], 'gain'],
              paint: {
                'fill-color': CANOPY_CHANGE_COLORS.gain,
                'fill-opacity': 0.7,
              },
            }}
          />
          <Layer
            {...{
              id: 'canopy-loss',
              type: 'fill',
              'source-layer': CANOPY_CHANGE_SOURCE_LAYER,
              minzoom: CANOPY_CHANGE_MIN_ZOOM,
              filter: ['==', ['get', 'change_class'], 'loss'],
              paint: {
                'fill-color': CANOPY_CHANGE_COLORS.loss,
                'fill-opacity': 0.7,
              },
            }}
          />
        </Source>
      )}

      {/* ── Boundary choropleth ─────────────────────────────────────── */}
      {layerData && !isLineLayer && (
        <Source id="boundary" type="geojson" data={layerData}>
          <Layer
            id="boundary-fill"
            type="fill"
            paint={{
              'fill-color': fillColorExpr,
              'fill-opacity': [
                'case',
                ['==', ['get', 'name'], selectedFeatureName ?? ''],
                0.9,
                0.75,
              ],
            }}
          />
          <Layer
            id="boundary-outline"
            type="line"
            paint={{
              'line-color': '#333',
              'line-width': 1.5,
              'line-opacity': 0.7,
            }}
          />
          <Layer
            id="boundary-labels"
            type="symbol"
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 11,
              'text-anchor': 'center',
              'text-allow-overlap': false,
              'text-ignore-placement': false,
            }}
            paint={{
              'text-color': '#1a1a2e',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            }}
          />
          <Layer
            id="boundary-hovered"
            type="line"
            filter={['==', ['get', 'name'], hoveredName]}
            paint={{
              'line-color': '#facc15',
              'line-width': 3,
              'line-opacity': 0.9,
            }}
          />
          <Layer
            id="boundary-selected"
            type="line"
            filter={['==', ['get', 'name'], selectedFeatureName ?? '']}
            paint={{
              'line-color': '#1a1a2e',
              'line-width': 3,
            }}
          />
        </Source>
      )}

      {/* ── Street layer (line geometry) ──────────────────────────────── */}
      {layerData && isLineLayer && (
        <Source id="boundary" type="geojson" data={layerData}>
          <Layer
            id="boundary-line"
            type="line"
            paint={{
              'line-color': fillColorExpr,
              'line-width': [
                'case',
                ['==', ['get', 'name'], selectedFeatureName ?? ''],
                6,
                3,
              ],
              'line-opacity': 0.85,
            }}
          />
          <Layer
            id="boundary-labels"
            type="symbol"
            minzoom={14}
            layout={{
              'text-field': ['get', 'name'],
              'text-size': 10,
              'symbol-placement': 'line',
              'text-allow-overlap': false,
            }}
            paint={{
              'text-color': '#1a1a2e',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            }}
          />
          <Layer
            id="boundary-hovered"
            type="line"
            filter={['==', ['get', 'name'], hoveredName]}
            paint={{
              'line-color': '#facc15',
              'line-width': 6,
              'line-opacity': 0.9,
            }}
          />
          <Layer
            id="boundary-selected"
            type="line"
            filter={['==', ['get', 'name'], selectedFeatureName ?? '']}
            paint={{
              'line-color': '#facc15',
              'line-width': 8,
              'line-opacity': 0.9,
            }}
          />
        </Source>
      )}

      {/* ── Mature tree loss polygons (PMTiles) ─────────────────────── */}
      {showTreeLosses && (
        <Source id="tree-losses" type="vector" url={treeLossesUrl}>
          <Layer
            {...{
              id: 'tree-losses-grove',
              type: 'fill',
              'source-layer': TREE_LOSSES_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM,
              filter: showStreetBuffer
                ? ['all', ['==', ['get', 'size_category'], 'grove'], ['==', ['get', 'in_street_buffer'], 1]]
                : ['==', ['get', 'size_category'], 'grove'],
              paint: {
                'fill-color': TREE_LOSS_COLORS.grove,
                'fill-opacity': 0.8,
              },
            }}
          />
          <Layer
            {...{
              id: 'tree-losses-tree',
              type: 'fill',
              'source-layer': TREE_LOSSES_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM,
              filter: showStreetBuffer
                ? ['all', ['==', ['get', 'size_category'], 'tree'], ['==', ['get', 'in_street_buffer'], 1]]
                : ['==', ['get', 'size_category'], 'tree'],
              paint: {
                'fill-color': TREE_LOSS_COLORS.tree,
                'fill-opacity': 0.7,
              },
            }}
          />
          <Layer
            {...{
              id: 'tree-losses-outline',
              type: 'line',
              'source-layer': TREE_LOSSES_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM + 1,
              filter: showStreetBuffer
                ? ['==', ['get', 'in_street_buffer'], 1]
                : ['has', 'size_category'],
              paint: {
                'line-color': '#5b0909',
                'line-width': 0.8,
                'line-opacity': 0.6,
              },
            }}
          />
        </Source>
      )}

      {/* ── Gain polygons (PMTiles) ────────────────────────────────── */}
      {showTreeGains && (
        <Source id="tree-gains" type="vector" url={treeGainsUrl}>
          <Layer
            {...{
              id: 'tree-gains-grove',
              type: 'fill',
              'source-layer': TREE_GAINS_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM,
              filter: showStreetBuffer
                ? ['all', ['==', ['get', 'size_category'], 'grove'], ['==', ['get', 'in_street_buffer'], 1]]
                : ['==', ['get', 'size_category'], 'grove'],
              paint: {
                'fill-color': TREE_GAIN_COLORS.grove,
                'fill-opacity': 0.8,
              },
            }}
          />
          <Layer
            {...{
              id: 'tree-gains-tree',
              type: 'fill',
              'source-layer': TREE_GAINS_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM,
              filter: showStreetBuffer
                ? ['all', ['==', ['get', 'size_category'], 'tree'], ['==', ['get', 'in_street_buffer'], 1]]
                : ['==', ['get', 'size_category'], 'tree'],
              paint: {
                'fill-color': TREE_GAIN_COLORS.tree,
                'fill-opacity': 0.7,
              },
            }}
          />
          <Layer
            {...{
              id: 'tree-gains-outline',
              type: 'line',
              'source-layer': TREE_GAINS_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM + 1,
              filter: showStreetBuffer
                ? ['==', ['get', 'in_street_buffer'], 1]
                : ['has', 'size_category'],
              paint: {
                'line-color': '#0a4a1e',
                'line-width': 0.8,
                'line-opacity': 0.6,
              },
            }}
          />
        </Source>
      )}

      {/* ── Hover popup ─────────────────────────────────────────────── */}
      {hoveredFeature && !clickedTree && (
        <Popup
          longitude={hoveredFeature.lngLat.lng}
          latitude={hoveredFeature.lngLat.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom-left"
          maxWidth="300px"
        >
          <InfoPanel feature={hoveredFeature.feature} method={activeMethodId} />
        </Popup>
      )}

      {clickedTree && (
        <Popup
          longitude={clickedTree.lngLat.lng}
          latitude={clickedTree.lngLat.lat}
          closeButton={true}
          closeOnClick={false}
          anchor="bottom"
          maxWidth="300px"
          onClose={() => setClickedTree(null)}
        >
          <TreePopup
            feature={clickedTree.feature}
            isGain={clickedTree.isGain}
          />
        </Popup>
      )}
    </Map>
  )
}
