import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS } from './config/layers'
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
import HelpModal       from './components/HelpModal'
import './index.css'


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
  const [showHelp, setShowHelp]                            = useState(() => localStorage.getItem('hideHelpOnStartup') !== '1')
  const [showLocation, setShowLocation]                   = useState(false)
  const [userLocation, setUserLocation]                   = useState(null)
  const [locationError, setLocationError]                 = useState(null)
  const [flyToLocation, setFlyToLocation]                 = useState(null)
  const [addressMarker, setAddressMarker]                 = useState(null)
  const watchIdRef                                        = useRef(null)

  // Map viewport — tracked for URL hash sharing
  const [mapCenter, setMapCenter] = useState({
    lat: hashState?.lat ?? 40.4406,
    lng: hashState?.lng ?? -79.9959,
  })

  // Tree to open on load (from URL hash)
  const [pendingTree, setPendingTree] = useState(hashState?.tree ?? null)

  const [currentZoom, setCurrentZoom]             = useState(hashState?.z ?? 11)

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

  // Listen for viewport changes (resize, rotation)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleZoom = useCallback(zoom => {
    setCurrentZoom(zoom)
  }, [])

  const resetExploration = useCallback(() => {
    setSelectedFeatureName(null)
    setHoveredFeature(null)
    setActiveBoundaryLayerId('neighborhoods')
    setActiveMethodId('net_pct_of_2015_canopy')
    setShowTreeLosses(true)
    setShowTreeGains(false)
    setShowStreetBuffer(true)
    setShowCanopyChange(false)
    setShowLocation(false)
    setAddressMarker(null)
    setFlyToLocation({ longitude: -79.9959, latitude: 40.4406, zoom: 11, bearing: 0, pitch: 0 })
  }, [])

  // Address search lands on a street-level zoom and drops a pin
  const handleAddressFound = useCallback(({ lat, lng, displayName }) => {
    setSelectedFeatureName(null)
    setAddressMarker({ lat, lng, label: displayName })
    setFlyToLocation({ longitude: lng, latitude: lat, zoom: 17, bearing: 0, pitch: 0 })
  }, [])

  const activeLayerConfig = BOUNDARY_LAYERS.find(l => l.id === activeBoundaryLayerId)

  // Fetch boundary GeoJSON (cached after first load)
  const { data: layerData, loading, error } = useLayerData(
    activeBoundaryLayerId,
    activeLayerConfig?.file
  )

  // Street centerlines (JS data for Street View offset calculation).
  // The buffer zone rendering uses the URL directly as a MapLibre source so
  // MapLibre parses it in its worker thread — no main-thread blocking.
  // The JS copy is only needed when tree overlays are visible (prerequisite for
  // clicking a tree to launch Street View), so we load it lazily then.
  // When Streets layer is already active its boundary data has the same geometry.
  const needsCenterlinesData = activeBoundaryLayerId !== 'streets'
    && (showTreeLosses || showTreeGains || showStreetBuffer)
  const { data: centerlinesFile, loading: centerlinesLoading } = useLayerData(
    'street_centerlines',
    needsCenterlinesData ? `${DATA_PREFIX}/streets/street_centerlines.geojson` : null
  )
  const streetCenterlines = activeBoundaryLayerId === 'streets' ? layerData : centerlinesFile

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

  // Rank of the selected feature (highest value = rank 1) for the map popup.
  const selectedFeatureRank = useMemo(() => {
    if (!selectedFeatureName || !enrichedLayerData?.features) return null
    const items = enrichedLayerData.features
      .map(f => ({ name: f.properties?.name, value: f.properties?.[activeMethodId] }))
      .filter(r => r.name && r.value != null)
      .sort((a, b) => b.value - a.value)
    const idx = items.findIndex(r => r.name === selectedFeatureName)
    return idx >= 0 ? { rank: idx + 1, total: items.length } : null
  }, [selectedFeatureName, enrichedLayerData, activeMethodId])

  function handleBoundaryLayerChange(id) {
    setActiveBoundaryLayerId(id)
    setSelectedFeatureName(null)
    setHoveredFeature(null)
  }

  function handleFeatureSelect(name) {
    setSelectedFeatureName(name)
  }

  // Dedupe hover updates so React/MapLibre don't thrash when the cursor
  // stays on the same feature (esp. the street layer with ~thousands of
  // line features — filter re-evaluation per mousemove was lagging).
  const handleHover = useCallback((val) => {
    setHoveredFeature(prev => {
      const prevName = prev?.feature?.properties?.name
      const nextName = val?.feature?.properties?.name
      if (prev != null && val != null && prevName === nextName) return prev
      return val
    })
  }, [])

  const handleHoverEnd = useCallback(() => {
    setHoveredFeature(prev => (prev === null ? prev : null))
  }, [])

  return (
    <div className="app-root">
      {(loading || (showStreetBuffer && centerlinesLoading)) && <div className="map-status">Loading layer data…</div>}
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
          showCanopyChange={showCanopyChange}
          streetCenterlines={streetCenterlines}
          selectedFeatureName={selectedFeatureName}
          selectedFeatureRank={selectedFeatureRank}
          hoveredFeature={hoveredFeature}
          onHover={handleHover}
          onHoverEnd={handleHoverEnd}
          onFeatureClick={handleFeatureSelect}
          userLocation={userLocation}
          addressMarker={addressMarker}
          onAddressMarkerDismiss={() => setAddressMarker(null)}
          flyToLocation={flyToLocation}
          onFlyToComplete={() => setFlyToLocation(null)}
          onZoom={handleZoom}
          onMapMove={handleMapMove}
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
        onAddressFound={handleAddressFound}
        onShare={handleShare}
        onReset={resetExploration}
        isMobile={isMobile}
        onMobileSearch={() => setSheetState('expanded')}
        onHelpOpen={() => setShowHelp(true)}
      />

      {/* ── Desktop panels ── */}
      {!isMobile && (
        <>
          {/* Left icon rail */}
          <nav className="left-rail" aria-label="Map navigation">
            <button className="rail-icon rail-icon--active" title="Reset view" aria-label="Reset view" onClick={resetExploration}>
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
              className={`rail-icon${showHelp ? ' rail-icon--active' : ''}`}
              onClick={() => setShowHelp(o => !o)}
              title="Help &amp; how to use"
              aria-label="Help"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </button>
          </nav>

          <LeaderboardPanel
            isOpen={leaderboardOpen}
            layerData={enrichedLayerData}
            activeMethodId={activeMethodId}
            selectedFeatureName={selectedFeatureName}
            onFeatureSelect={handleFeatureSelect}
            onHover={handleHover}
            onHoverEnd={handleHoverEnd}
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
            showLocation={showLocation}
            onShowLocationChange={setShowLocation}
            locationAvailable={locationAvailable}
            locationError={locationError}
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
            colorBreaks={colorBreaks}
            activeLayer={activeLayerConfig}
            onFeatureSelect={handleFeatureSelect}
            onAddressFound={handleAddressFound}
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
            showLocation={showLocation}
            onShowLocationChange={setShowLocation}
            locationAvailable={locationAvailable}
            locationError={locationError}
            onHover={handleHover}
            onHoverEnd={handleHoverEnd}
          />
        </>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
