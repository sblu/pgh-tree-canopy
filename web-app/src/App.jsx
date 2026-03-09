import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { BOUNDARY_LAYERS, STREET_BUFFER_PATH, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS } from './config/layers'
import { useLayerData, computeQuantileBreaks } from './hooks/useLayerData'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import './index.css'

export default function App() {
  const [activeBoundaryLayerId, setActiveBoundaryLayerId] = useState('neighborhoods')
  const [activeMethodId, setActiveMethodId]               = useState('canopy_2020_pct')
  const [showTreeLosses, setShowTreeLosses]               = useState(true)
  const [showTreeGains, setShowTreeGains]                 = useState(true)
  const [showStreetBuffer, setShowStreetBuffer]           = useState(false)
  const [showCanopyChange, setShowCanopyChange]           = useState(false)
  const [hoveredFeature, setHoveredFeature]               = useState(null)
  const [selectedFeatureName, setSelectedFeatureName]     = useState(null)
  const [sidebarOpen, setSidebarOpen]                     = useState(true)
  const [showLocation, setShowLocation]                   = useState(false)
  const [userLocation, setUserLocation]                   = useState(null)
  const [locationError, setLocationError]                 = useState(null)
  const [flyToLocation, setFlyToLocation]                 = useState(null)
  const watchIdRef                                        = useRef(null)

  const locationAvailable = navigator.geolocation && window.isSecureContext

  // Start/stop watching geolocation when toggle changes
  useEffect(() => {
    if (!showLocation) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setUserLocation(null)
      // Don't clear locationError here — let it persist so user sees why it failed
      return
    }
    if (!locationAvailable) {
      setLocationError('Location requires HTTPS')
      setShowLocation(false)
      return
    }
    // Clear any previous error when user tries again
    setLocationError(null)
    console.log('[Location] Starting watchPosition, isSecureContext:', window.isSecureContext)
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const loc = { longitude: pos.coords.longitude, latitude: pos.coords.latitude }
        setLocationError(null)
        setUserLocation(prev => {
          if (!prev) setFlyToLocation(loc)
          return loc
        })
      },
      err => {
        console.warn('[Location] Error:', err.code, err.message)
        setLocationError(
          err.code === 1 ? 'Location permission denied'
          : err.code === 3 ? 'Location timed out'
          : 'Location unavailable'
        )
        setShowLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    )
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [showLocation, locationAvailable])

  const handlePanToLocation = useCallback(() => {
    if (userLocation) setFlyToLocation(userLocation)
  }, [userLocation])

  const activeLayerConfig = BOUNDARY_LAYERS.find(l => l.id === activeBoundaryLayerId)

  // Fetch boundary GeoJSON (cached after first load)
  const { data: layerData, loading, error } = useLayerData(
    activeBoundaryLayerId,
    activeLayerConfig?.file
  )

  // Fetch street buffer (cached after first load)
  const { data: streetBufferData } = useLayerData('street_buffer', STREET_BUFFER_PATH)

  // Fetch street centerlines for Street View nearest-street calculation
  const { data: streetCenterlines } = useLayerData(
    'street_centerlines', 'data/streets/street_centerlines.geojson'
  )

  // Enrich features with canopy_2020_pct (derived from existing fields)
  const enrichedLayerData = useMemo(() => {
    if (!layerData?.features) return layerData
    return {
      ...layerData,
      features: layerData.features.map(f => {
        const p = f.properties
        if (p.canopy_2020_pct != null) return f // already computed
        const area = p.land_area_acres
        const canopy = p.canopy_2020_acres
        const pct = area > 0 && canopy != null
          ? parseFloat((canopy / area * 100).toFixed(2))
          : null
        return { ...f, properties: { ...p, canopy_2020_pct: pct } }
      }),
    }
  }, [layerData])

  const activeMethod = COLOR_METHODS.find(m => m.id === activeMethodId)
  const isCoverage = activeMethod?.group === 'coverage'
  const activeColors = isCoverage ? COVERAGE_COLORS : CHOROPLETH_COLORS

  // Recompute colour breaks when layer data or active metric changes
  const colorBreaks = useMemo(
    () => computeQuantileBreaks(enrichedLayerData, activeMethodId),
    [enrichedLayerData, activeMethodId]
  )

  function handleBoundaryLayerChange(id) {
    setActiveBoundaryLayerId(id)
    setSelectedFeatureName(null)
    setHoveredFeature(null)
  }

  function handleFeatureSelect(name) {
    setSelectedFeatureName(name)
  }

  return (
    <div className="app-layout">
      <div className={`sidebar-wrapper${sidebarOpen ? '' : ' collapsed'}`}>
      <Sidebar
        activeBoundaryLayerId={activeBoundaryLayerId}
        onBoundaryLayerChange={handleBoundaryLayerChange}
        activeMethodId={activeMethodId}
        onMethodChange={setActiveMethodId}
        showTreeLosses={showTreeLosses}
        onShowTreeLossesChange={setShowTreeLosses}
        showTreeGains={showTreeGains}
        onShowTreeGainsChange={setShowTreeGains}
        showStreetBuffer={showStreetBuffer}
        onShowStreetBufferChange={setShowStreetBuffer}
        showCanopyChange={showCanopyChange}
        onShowCanopyChangeChange={setShowCanopyChange}
        layerData={enrichedLayerData}
        colorBreaks={colorBreaks}
        onFeatureSelect={handleFeatureSelect}
        onHover={setHoveredFeature}
        onHoverEnd={() => setHoveredFeature(null)}
        showLocation={showLocation}
        onShowLocationChange={setShowLocation}
        userLocation={userLocation}
        locationError={locationError}
        locationAvailable={locationAvailable}
        onPanToLocation={handlePanToLocation}
      />
      </div>

      <main className="map-container">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '\u25C0' : '\u25B6'}
        </button>
        {loading && <div className="map-status">Loading layer data…</div>}
        {error   && <div className="map-status error">Error: {error}</div>}

        <MapView
          layerData={enrichedLayerData}
          activeLayerConfig={activeLayerConfig}
          activeMethodId={activeMethodId}
          colorBreaks={colorBreaks}
          choroplethColors={activeColors}
          showTreeLosses={showTreeLosses}
          showTreeGains={showTreeGains}
          showStreetBuffer={showStreetBuffer}
          streetBufferData={streetBufferData}
          showCanopyChange={showCanopyChange}
          streetCenterlines={streetCenterlines}
          selectedFeatureName={selectedFeatureName}
          hoveredFeature={hoveredFeature}
          onHover={setHoveredFeature}
          onHoverEnd={() => setHoveredFeature(null)}
          onFeatureClick={handleFeatureSelect}
          userLocation={userLocation}
          flyToLocation={flyToLocation}
          onFlyToComplete={() => setFlyToLocation(null)}
        />
      </main>
    </div>
  )
}
