import { useRef, useCallback, useMemo, useEffect } from 'react'
import Map, { Source, Layer, Popup, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  CHOROPLETH_COLORS,
  TREE_LOSS_COLORS,
  TREE_LOSSES_PMTILES_PATH,
  TREE_LOSSES_SOURCE_LAYER,
  TREE_LOSSES_MIN_ZOOM,
  STREET_BUFFER_COLOR,
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

export default function MapView({
  layerData,
  activeMethodId,
  colorBreaks,
  showTreeLosses,
  showStreetBuffer,
  streetBufferData,
  selectedFeatureName,
  hoveredFeature,
  onHover,
  onHoverEnd,
  onFeatureClick,
}) {
  const mapRef = useRef(null)

  // Build pmtiles:// URL using the current page origin so it works in both
  // dev (localhost:5173) and production (wordpress server)
  const treeLossesUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `pmtiles://${origin}${TREE_LOSSES_PMTILES_PATH}`
  }, [])

  // Fill colour expression, recomputed when method or breaks change
  const fillColorExpr = useMemo(
    () => buildColorExpression(activeMethodId, colorBreaks, CHOROPLETH_COLORS),
    [activeMethodId, colorBreaks]
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
    if (feature) onFeatureClick(feature.properties?.name)
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
      interactiveLayerIds={layerData ? ['boundary-fill'] : []}
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

      {/* ── Boundary choropleth ─────────────────────────────────────── */}
      {layerData && (
        <Source id="boundary" type="geojson" data={layerData}>
          {/* Fill — coloured by active loss metric */}
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

          {/* Outline — all zones */}
          <Layer
            id="boundary-outline"
            type="line"
            paint={{
              'line-color': '#333',
              'line-width': 1.5,
              'line-opacity': 0.7,
            }}
          />

          {/* Zone name labels */}
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

          {/* Selected feature — thick highlight outline */}
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

      {/* ── Mature tree loss polygons (PMTiles) ─────────────────────── */}
      {showTreeLosses && (
        <Source id="tree-losses" type="vector" url={treeLossesUrl}>
          {/* Groves (≥ 0.07 ac) — dark red, rendered below single trees */}
          <Layer
            {...{
              id: 'tree-losses-grove',
              type: 'fill',
              'source-layer': TREE_LOSSES_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM,
              filter: ['==', ['get', 'size_category'], 'grove'],
              paint: {
                'fill-color': TREE_LOSS_COLORS.grove,
                'fill-opacity': 0.8,
              },
            }}
          />
          {/* Single trees (0.04–0.07 ac) — red */}
          <Layer
            {...{
              id: 'tree-losses-tree',
              type: 'fill',
              'source-layer': TREE_LOSSES_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM,
              filter: ['==', ['get', 'size_category'], 'tree'],
              paint: {
                'fill-color': TREE_LOSS_COLORS.tree,
                'fill-opacity': 0.7,
              },
            }}
          />
          {/* Outline on all tree loss polygons at high zoom */}
          <Layer
            {...{
              id: 'tree-losses-outline',
              type: 'line',
              'source-layer': TREE_LOSSES_SOURCE_LAYER,
              minzoom: TREE_LOSSES_MIN_ZOOM + 1,
              paint: {
                'line-color': '#5b0909',
                'line-width': 0.8,
                'line-opacity': 0.6,
              },
            }}
          />
        </Source>
      )}

      {/* ── Hover popup ─────────────────────────────────────────────── */}
      {hoveredFeature && (
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
    </Map>
  )
}
