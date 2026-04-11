import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { BOUNDARY_LAYERS, STREET_BUFFER_PATH, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS, LOCAL_STORAGE_KEY } from './config/layers'
import { DATA_PREFIX, SOURCE_LABEL, IS_PUBLIC_SOURCE } from './config/dataSource'
import { useLayerData, computeQuantileBreaks } from './hooks/useLayerData'
import { useUrlHash } from './hooks/useUrlHash'
import TopBar          from './components/TopBar'
import ControlsPanel   from './components/ControlsPanel'
import LeaderboardPanel from './components/LeaderboardPanel'
import LegendPanel     from './components/LegendPanel'
import MobileChips     from './components/MobileChips'
import MobileSheet     from './components/MobileSheet'
import MapView         from './components/MapView'
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
  const { initialState: hashState, writeHash, getShareUrl } = useUrlHash()

  const [activeBoundaryLayerId, setActiveBoundaryLayerId] = useState(hashState?.layer ?? 'neighborhoods')
  const [activeMethodId, setActiveMethodId]               = useState(hashState?.method ?? 'net_pct_of_2015_canopy')
  const [showTreeLosses, setShowTreeLosses]               = useState(hashState?.losses ?? true)
  const [showTreeGains, setShowTreeGains]                 = useState(hashState?.gains ?? false)
  const [showStreetBuffer, setShowStreetBuffer]           = useState(hashState?.buffer ?? true)
  const [showCanopyChange, setShowCanopyChange]           = useState(hashState?.canopy ?? false)
  const [hoveredFeature, setHoveredFeature]               = useState(null)
  const [selectedFeatureName, setSelectedFeatureName]     = useState(hashState?.selected ?? null)
  const [leaderboardOpen, setLeaderboardOpen]              = useState(true)
  const [showLocation, setShowLocation]                   = useState(false)
  const [userLocation, setUserLocation]                   = useState(null)
  const [locationError, setLocationError]                 = useState(null)
  const [flyToLocation, setFlyToLocation]                 = useState(null)
  const watchIdRef                                        = useRef(null)

  // Map viewport — tracked for URL hash sharing
  const [mapCenter, setMapCenter] = useState({
    lat: hashState?.lat ?? 40.4406,
    lng: hashState?.lng ?? -79.9959,
  })

  // Tree to open on load (from URL hash)
  const [pendingTree, setPendingTree] = useState(hashState?.tree ?? null)

  // Progressive disclosure state — skip landing if URL has state
  const [explorationStage, setExplorationStage]   = useState(hashState ? 'exploring' : 'landing')
  const [currentZoom, setCurrentZoom]             = useState(hashState?.z ?? 11)
  const [hasViewedStreetView, setHasViewedStreetView] = useState(false)
  const [advancedExpanded, setAdvancedExpanded]   = useState(() => loadStorage('advancedExpanded', false))
  const [ctaDismissed, setCtaDismissed]           = useState(() => loadStorage('ctaDismissed', false))
  const [streetPath, setStreetPath]               = useState(false)

  const [sheetState, setSheetState] = useState('peek') // peek | expanded | full
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  const locationAvailable = navigator.geolocation && window.isSecureContext

  // Active tree for URL sharing (set by MapView when street view is open)
  const [activeTreeForShare, setActiveTreeForShare] = useState(null)

  // Sync state → URL hash (debounced)
  useEffect(() => {
    writeHash({
      lat: mapCenter.lat, lng: mapCenter.lng, z: currentZoom,
      layer: activeBoundaryLayerId, method: activeMethodId,
      losses: showTreeLosses, gains: showTreeGains,
      buffer: showStreetBuffer, canopy: showCanopyChange,
      selected: selectedFeatureName, tree: activeTreeForShare,
    })
  }, [mapCenter, currentZoom, activeBoundaryLayerId, activeMethodId,
      showTreeLosses, showTreeGains, showStreetBuffer, showCanopyChange,
      selectedFeatureName, activeTreeForShare, writeHash])

  // Handle map viewport changes
  const handleMapMove = useCallback((center) => {
    setMapCenter(center)
  }, [])

  // Build current share state
  const buildShareState = useCallback((treeOverride) => ({
    lat: mapCenter.lat, lng: mapCenter.lng, z: currentZoom,
    layer: activeBoundaryLayerId, method: activeMethodId,
    losses: showTreeLosses, gains: showTreeGains,
    buffer: showStreetBuffer, canopy: showCanopyChange,
    selected: selectedFeatureName,
    tree: treeOverride ?? activeTreeForShare,
  }), [mapCenter, currentZoom, activeBoundaryLayerId, activeMethodId,
       showTreeLosses, showTreeGains, showStreetBuffer, showCanopyChange,
       selectedFeatureName, activeTreeForShare])

  // Share: copy current URL to clipboard
  const handleShare = useCallback(async (treeOverride) => {
    const url = getShareUrl(buildShareState(treeOverride))
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  }, [buildShareState, getShareUrl])

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

  const handleCtaReshow = useCallback(() => {
    setCtaDismissed(false)
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
    'street_centerlines', `${DATA_PREFIX}/streets/street_centerlines.geojson`
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

  // Recompute colour breaks when layer data or active metric changes.
  // For net-change metrics, force 0 as the middle break so that
  // warm colours (loss) are always < 0% and cool colours (gain) are always >= 0%.
  const isDiverging = activeMethod?.group === 'net_change'
  const colorBreaks = useMemo(
    () => computeQuantileBreaks(enrichedLayerData, activeMethodId, 5, isDiverging),
    [enrichedLayerData, activeMethodId, isDiverging]
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
    <div className="app-root">
      {loading && <div className="map-status">Loading layer data…</div>}
      {error   && <div className="map-status error">Error: {error}</div>}
      {IS_PUBLIC_SOURCE && (
        <div className="public-banner">{SOURCE_LABEL} Data</div>
      )}

      {/* Map — always fills full viewport */}
      <div className="map-container">
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
          onMapMove={handleMapMove}
          onStreetViewClose={handleStreetViewClose}
          onActiveTreeChange={setActiveTreeForShare}
          onShare={handleShare}
          isMobile={isMobile}
          sheetState={sheetState}
          initialCenter={mapCenter}
          initialZoom={hashState?.z ?? 11}
          pendingTree={pendingTree}
          onPendingTreeHandled={() => setPendingTree(null)}
        />
      </div>

      {/* Top bar — always visible */}
      <TopBar
        activeLayer={activeLayerConfig}
        layerData={enrichedLayerData}
        selectedFeatureName={selectedFeatureName}
        onFeatureSelect={handleFeatureSelect}
        onShare={handleShare}
        onReset={resetExploration}
        isMobile={isMobile}
        onMobileSearch={() => setSheetState('expanded')}
      />

      {/* ── Desktop panels ── */}
      {!isMobile && (
        <>
          {/* Left icon rail */}
          <nav className="left-rail" aria-label="Map navigation">
            <button className="rail-icon rail-icon--active" title="Map view" aria-label="Map view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
              </svg>
            </button>
            <button
              className={`rail-icon${leaderboardOpen ? ' rail-icon--active' : ''}`}
              onClick={() => setLeaderboardOpen(o => !o)}
              title={leaderboardOpen ? 'Hide leaderboard' : 'Show leaderboard'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
            <div className="rail-divider" />
            <button
              className={`rail-icon${showLocation ? ' rail-icon--active' : ''}`}
              onClick={() => setShowLocation(o => !o)}
              title={locationError || (showLocation ? 'Hide my location' : 'Show my location')}
              disabled={!locationAvailable}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
            </button>
          </nav>

          <LeaderboardPanel
            isOpen={leaderboardOpen}
            layerData={enrichedLayerData}
            activeMethodId={activeMethodId}
            selectedFeatureName={selectedFeatureName}
            onFeatureSelect={handleFeatureSelect}
            onHover={setHoveredFeature}
            onHoverEnd={() => setHoveredFeature(null)}
          />

          <ControlsPanel
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
          />

          <LegendPanel
            colorBreaks={colorBreaks}
            activeMethodId={activeMethodId}
            isCoverage={isCoverage}
          />
        </>
      )}

      {/* ── Mobile panels ── */}
      {isMobile && (
        <>
          <MobileChips
            activeBoundaryLayerId={activeBoundaryLayerId}
            onBoundaryLayerChange={handleBoundaryLayerChange}
            activeMethodId={activeMethodId}
            onMethodChange={setActiveMethodId}
            showTreeLosses={showTreeLosses}
            onShowTreeLossesChange={setShowTreeLosses}
            showTreeGains={showTreeGains}
            onShowTreeGainsChange={setShowTreeGains}
          />
          <MobileSheet
            sheetState={sheetState}
            onSheetStateChange={setSheetState}
            selectedFeatureName={selectedFeatureName}
            layerData={enrichedLayerData}
            activeMethodId={activeMethodId}
            isCoverage={isCoverage}
            activeLayer={activeLayerConfig}
            onFeatureSelect={handleFeatureSelect}
            activeBoundaryLayerId={activeBoundaryLayerId}
            onBoundaryLayerChange={handleBoundaryLayerChange}
            onMethodChange={setActiveMethodId}
            showTreeLosses={showTreeLosses}
            onShowTreeLossesChange={setShowTreeLosses}
            showTreeGains={showTreeGains}
            onShowTreeGainsChange={setShowTreeGains}
            showStreetBuffer={showStreetBuffer}
            onShowStreetBufferChange={setShowStreetBuffer}
            showCanopyChange={showCanopyChange}
            onShowCanopyChangeChange={setShowCanopyChange}
            onHover={setHoveredFeature}
            onHoverEnd={() => setHoveredFeature(null)}
          />
        </>
      )}
    </div>
  )
}
