import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { BOUNDARY_LAYERS, STREET_BUFFER_PATH, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS, LOCAL_STORAGE_KEY, CTA_LINKS } from './config/layers'
import { useLayerData, computeQuantileBreaks } from './hooks/useLayerData'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import './index.css'

function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed[key] ?? fallback
  } catch { return fallback }
}

function saveStorage(key, value) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    obj[key] = value
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj))
  } catch { /* ignore */ }
}

export default function App() {
  const [activeBoundaryLayerId, setActiveBoundaryLayerId] = useState('neighborhoods')
  const [activeMethodId, setActiveMethodId]               = useState('net_pct_of_2015_canopy')
  const [showTreeLosses, setShowTreeLosses]               = useState(true)
  const [showTreeGains, setShowTreeGains]                 = useState(false)
  const [showStreetBuffer, setShowStreetBuffer]           = useState(true)
  const [showCanopyChange, setShowCanopyChange]           = useState(false)
  const [hoveredFeature, setHoveredFeature]               = useState(null)
  const [selectedFeatureName, setSelectedFeatureName]     = useState(null)
  const [sidebarOpen, setSidebarOpen]                     = useState(true)
  const [showLocation, setShowLocation]                   = useState(false)
  const [userLocation, setUserLocation]                   = useState(null)
  const [locationError, setLocationError]                 = useState(null)
  const [flyToLocation, setFlyToLocation]                 = useState(null)
  const watchIdRef                                        = useRef(null)

  // Progressive disclosure state
  const [explorationStage, setExplorationStage]   = useState('landing')
  const [currentZoom, setCurrentZoom]             = useState(11)
  const [hasViewedStreetView, setHasViewedStreetView] = useState(false)
  const [advancedExpanded, setAdvancedExpanded]   = useState(() => loadStorage('advancedExpanded', false))
  const [ctaDismissed, setCtaDismissed]           = useState(() => loadStorage('ctaDismissed', false))
  const [streetPath, setStreetPath]               = useState(false)

  const [sheetState, setSheetState] = useState('peek') // peek | expanded | full
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  const sheetWrapperRef = useRef(null)

  const locationAvailable = navigator.geolocation && window.isSecureContext

  // Start/stop watching geolocation when toggle changes
  useEffect(() => {
    if (!showLocation) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setUserLocation(null) // eslint-disable-line react-hooks/set-state-in-effect
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

  // Stage transitions (forward-only state machine — setState in effect is intentional)
  useEffect(() => {
    if (explorationStage === 'landing' && selectedFeatureName && !streetPath) {
      setExplorationStage('neighborhood') // eslint-disable-line react-hooks/set-state-in-effect
      saveStorage('hasVisited', true)
    }
  }, [explorationStage, selectedFeatureName, streetPath])

  useEffect(() => {
    if (explorationStage === 'landing' && selectedFeatureName && streetPath) {
      setExplorationStage('street-level') // eslint-disable-line react-hooks/set-state-in-effect
      saveStorage('hasVisited', true)
    }
  }, [explorationStage, selectedFeatureName, streetPath])

  useEffect(() => {
    if (explorationStage === 'neighborhood' && selectedFeatureName && currentZoom >= 12) {
      setExplorationStage('street-level') // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [explorationStage, selectedFeatureName, currentZoom])

  useEffect(() => {
    if (explorationStage === 'street-level' && hasViewedStreetView) {
      setExplorationStage('post-streetview') // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [explorationStage, hasViewedStreetView])

  // Listen for viewport changes (resize, rotation)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Mobile: auto-expand sheet when stage changes (except landing)
  useEffect(() => {
    if (isMobile && explorationStage !== 'landing') {
      setSheetState('expanded') // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [explorationStage, isMobile])

  const handlePanToLocation = useCallback(() => {
    if (userLocation) setFlyToLocation(userLocation)
  }, [userLocation])

  const handleZoom = useCallback(zoom => {
    setCurrentZoom(zoom)
  }, [])

  const handleStreetViewClose = useCallback(() => {
    setHasViewedStreetView(true)
  }, [])

  const handleAdvancedToggle = useCallback(expanded => {
    setAdvancedExpanded(expanded)
    saveStorage('advancedExpanded', expanded)
  }, [])

  const handleCtaDismiss = useCallback(() => {
    setCtaDismissed(true)
    saveStorage('ctaDismissed', true)
    setExplorationStage('exploring')
  }, [])

  const handleStreetPathStart = useCallback(() => {
    setStreetPath(true)
    setActiveBoundaryLayerId('streets')
    setSelectedFeatureName(null)
    setHoveredFeature(null)
  }, [])

  const handleMobileSearchFocus = useCallback(() => {
    if (isMobile && sheetState === 'peek') {
      setSheetState('expanded')
    }
  }, [isMobile, sheetState])

  const resetExploration = useCallback(() => {
    setExplorationStage('landing')
    setSelectedFeatureName(null)
    setHoveredFeature(null)
    setHasViewedStreetView(false)
    setStreetPath(false)
    setActiveBoundaryLayerId('neighborhoods')
    setActiveMethodId('net_pct_of_2015_canopy')
    setShowTreeLosses(true)
    setShowTreeGains(false)
    setShowStreetBuffer(true)
    setShowCanopyChange(false)
    setShowLocation(false)
    setAdvancedExpanded(false)
    saveStorage('advancedExpanded', false)
    setCtaDismissed(false)
    setFlyToLocation({ longitude: -79.9959, latitude: 40.4406, zoom: 11 })
  }, [])

  // Mobile bottom sheet: tap header to toggle, swipe to change state
  const dragStartY = useRef(0)

  useEffect(() => {
    if (!isMobile) return
    const wrapper = sheetWrapperRef.current
    const handle = wrapper?.querySelector('.sheet-drag-handle')
    const header = wrapper?.querySelector('.sidebar-header')
    if (!handle && !header) return

    const targets = [handle, header].filter(Boolean)

    const onTouchStart = e => {
      dragStartY.current = e.touches[0].clientY
    }

    const onTouchEnd = e => {
      const deltaY = e.changedTouches[0].clientY - dragStartY.current
      const threshold = 50
      if (deltaY < -threshold) {
        // Swiped up
        setSheetState(prev => prev === 'peek' ? 'expanded' : 'full')
      } else if (deltaY > threshold) {
        // Swiped down
        setSheetState(prev => prev === 'full' ? 'expanded' : 'peek')
      } else {
        // Tap (no significant drag) — toggle between peek and expanded
        setSheetState(prev => prev === 'peek' ? 'expanded' : 'peek')
      }
    }

    for (const el of targets) {
      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchend', onTouchEnd, { passive: true })
    }
    return () => {
      for (const el of targets) {
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchend', onTouchEnd)
      }
    }
  }, [isMobile])

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
    if (id !== 'streets') setStreetPath(false)
  }

  function handleFeatureSelect(name) {
    setSelectedFeatureName(name)
  }

  return (
    <div className="app-layout">
      <div
        className={`sidebar-wrapper${sidebarOpen ? '' : ' collapsed'}`}
        data-sheet={isMobile ? sheetState : undefined}
        ref={sheetWrapperRef}
      >
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
        explorationStage={explorationStage}
        currentZoom={currentZoom}
        advancedExpanded={advancedExpanded}
        onAdvancedToggle={handleAdvancedToggle}
        ctaDismissed={ctaDismissed}
        onCtaDismiss={handleCtaDismiss}
        onReset={resetExploration}
        selectedFeatureName={selectedFeatureName}
        onMobileSearchFocus={handleMobileSearchFocus}
        streetPath={streetPath}
        onStreetPathStart={handleStreetPathStart}
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
        {/* Mobile: prominent CTA banner shown over map */}
        {isMobile && explorationStage === 'post-streetview' && !ctaDismissed && (
          <div className="mobile-cta-banner">
            <div className="cta-prominent">
              <div className="cta-prominent-title">Help Restore Pittsburgh's Canopy</div>
              <div className="cta-prominent-body">
                Every tree matters. Here's how you can make a difference:
              </div>
              <div className="cta-actions">
                {Object.values(CTA_LINKS).map(link => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="cta-action-btn">
                    <span className="cta-action-emoji">{link.emoji}</span>
                    <div>
                      <div className="cta-action-label">{link.label}</div>
                      <div className="cta-action-desc">{link.description}</div>
                    </div>
                  </a>
                ))}
              </div>
              <button className="cta-dismiss" onClick={handleCtaDismiss}>Dismiss</button>
            </div>
          </div>
        )}
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
          onZoom={handleZoom}
          onStreetViewClose={handleStreetViewClose}
        />
      </main>
    </div>
  )
}
