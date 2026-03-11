import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import Map, { Source, Layer, Popup, Marker, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'

import TreePopup from './TreePopup'
import StreetViewModal from './StreetViewModal'
import useStreetView from '../hooks/useStreetView'
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

// Layers that must always render on top of boundary layers, in stacking order
const LAYERS_ON_TOP = [
  'tree-losses-grove', 'tree-losses-tree', 'tree-losses-outline',
  'tree-gains-grove', 'tree-gains-tree', 'tree-gains-outline',
]

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
  streetCenterlines,
  selectedFeatureName,
  hoveredFeature,
  onHover,
  onHoverEnd,
  onFeatureClick,
  userLocation,
  flyToLocation,
  onFlyToComplete,
}) {
  const mapRef = useRef(null)
  const [clickedTree, setClickedTree] = useState(null)
  const { loading: svLoading, panoData: svPanoData, disabled: svDisabled } = useStreetView(clickedTree, streetCenterlines)

  // Build pmtiles:// URLs relative to the page's base URL.
  // This works regardless of what subdirectory the app is deployed to.
  const appBaseUrl = useMemo(() => {
    const base = document.baseURI || window.location.href
    // Remove filename/query/hash to get the directory
    return base.replace(/\/[^/]*$/, '')
  }, [])

  const treeLossesUrl = useMemo(
    () => `pmtiles://${appBaseUrl}/${TREE_LOSSES_PMTILES_PATH}`, [appBaseUrl])
  const treeGainsUrl = useMemo(
    () => `pmtiles://${appBaseUrl}/${TREE_GAINS_PMTILES_PATH}`, [appBaseUrl])
  const canopyChangeUrl = useMemo(
    () => `pmtiles://${appBaseUrl}/${CANOPY_CHANGE_PMTILES_PATH}`, [appBaseUrl])

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

  // Enforce layer stacking: tree gain/loss layers must always render
  // above boundary layers. When sources load at different times,
  // react-map-gl may add layers in the wrong order.
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const reorder = () => {
      for (const id of LAYERS_ON_TOP) {
        if (map.getLayer(id)) map.moveLayer(id)
      }
    }
    // Reorder now and also whenever new source data finishes loading
    reorder()
    map.on('sourcedata', reorder)
    return () => map.off('sourcedata', reorder)
  }, [layerData, showTreeLosses, showTreeGains])

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

  // Fly to user's location when requested
  useEffect(() => {
    if (!flyToLocation || !mapRef.current) return
    const map = mapRef.current.getMap()
    map.flyTo({
      center: [flyToLocation.longitude, flyToLocation.latitude],
      zoom: 15,
      duration: 1200,
    })
    onFlyToComplete()
  }, [flyToLocation, onFlyToComplete])

  const [hoveredTree, setHoveredTree] = useState(null)

  // When multiple interactive layers overlap, prefer tree polygons over boundary fill
  const pickTreeFeature = (features) =>
    features?.find(f => TREE_LAYER_IDS.includes(f.layer?.id))

  const handleMouseMove = useCallback(e => {
    const treeFeature = pickTreeFeature(e.features)
    const feature = treeFeature || e.features?.[0]
    if (treeFeature) {
      setHoveredTree({
        feature: treeFeature,
        lngLat: e.lngLat,
        isGain: treeFeature.layer.id.startsWith('tree-gains'),
      })
      onHoverEnd()
    } else if (feature) {
      setHoveredTree(null)
      onHover({ feature, lngLat: e.lngLat })
    } else {
      setHoveredTree(null)
      onHoverEnd()
    }
  }, [onHover, onHoverEnd])

  const handleMouseLeave = useCallback(() => onHoverEnd(), [onHoverEnd])

  const handleClick = useCallback(e => {
    const treeFeature = pickTreeFeature(e.features)
    const feature = treeFeature || e.features?.[0]
    if (!feature) {
      setClickedTree(null)
      setHoveredTree(null)
      return
    }
    if (treeFeature) {
      const isGain = treeFeature.layer.id.startsWith('tree-gains')
      setHoveredTree(null)
      setClickedTree({
        feature: treeFeature,
        lngLat: e.lngLat,
        isGain,
      })
    } else {
      setClickedTree(null)
      setHoveredTree(null)
      onFeatureClick(feature.properties?.name)
    }
  }, [onFeatureClick])

  const handleMapError = useCallback(e => {
    console.error('[MapView] Map error:', e)
  }, [])

  return (
    <>
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
      cursor={hoveredFeature || hoveredTree ? 'pointer' : 'grab'}
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

      {/* ── User location blue dot ───────────────────────────────── */}
      {userLocation && (
        <Marker
          longitude={userLocation.longitude}
          latitude={userLocation.latitude}
          anchor="center"
        >
          <div className="user-location-dot" />
        </Marker>
      )}

      {/* ── Hover popup (boundary zones) — close button visible on mobile only */}
      {hoveredFeature && !clickedTree && !hoveredTree && (
        <Popup
          longitude={hoveredFeature.lngLat.lng}
          latitude={hoveredFeature.lngLat.lat}
          closeButton={true}
          closeOnClick={false}
          anchor="bottom-left"
          maxWidth="300px"
          className="popup-hover"
          onClose={onHoverEnd}
        >
          <InfoPanel feature={hoveredFeature.feature} method={activeMethodId} />
        </Popup>
      )}

      {/* ── Hover popup (tree gain/loss) — no close button ──────────── */}
      {hoveredTree && !clickedTree && (
        <Popup
          longitude={hoveredTree.lngLat.lng}
          latitude={hoveredTree.lngLat.lat}
          closeButton={false}
          closeOnClick={false}
          anchor="bottom"
          maxWidth="300px"
        >
          <TreePopup
            feature={hoveredTree.feature}
            isGain={hoveredTree.isGain}
            streetCenterlines={streetCenterlines}
            hoverMode
          />
        </Popup>
      )}

      {/* ── Click popup (tree gain/loss — Street View + close button) ── */}
      {clickedTree && !svPanoData && (
        <Popup
          longitude={clickedTree.lngLat.lng}
          latitude={clickedTree.lngLat.lat}
          closeButton={true}
          closeOnClick={false}
          anchor="bottom"
          maxWidth="300px"
          className="popup-with-close"
          onClose={() => setClickedTree(null)}
        >
          <TreePopup
            feature={clickedTree.feature}
            isGain={clickedTree.isGain}
            streetCenterlines={streetCenterlines}
            streetViewLoading={svLoading}
            streetViewDisabled={svDisabled}
          />
        </Popup>
      )}
    </Map>

      {svPanoData && clickedTree && (
        <StreetViewModal
          panoData={svPanoData}
          isGain={clickedTree.isGain}
          feature={clickedTree.feature}
          onClose={() => setClickedTree(null)}
        />
      )}
    </>
  )
}
