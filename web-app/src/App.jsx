import { useState, useMemo } from 'react'
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
  const [hoveredFeature, setHoveredFeature]               = useState(null)
  const [selectedFeatureName, setSelectedFeatureName]     = useState(null)

  const activeLayerConfig = BOUNDARY_LAYERS.find(l => l.id === activeBoundaryLayerId)

  // Fetch boundary GeoJSON (cached after first load)
  const { data: layerData, loading, error } = useLayerData(
    activeBoundaryLayerId,
    activeLayerConfig?.file
  )

  // Fetch street buffer (cached after first load)
  const { data: streetBufferData } = useLayerData('street_buffer', STREET_BUFFER_PATH)

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
        layerData={enrichedLayerData}
        colorBreaks={colorBreaks}
        onFeatureSelect={handleFeatureSelect}
        onHover={setHoveredFeature}
        onHoverEnd={() => setHoveredFeature(null)}
      />

      <main className="map-container">
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
          selectedFeatureName={selectedFeatureName}
          hoveredFeature={hoveredFeature}
          onHover={setHoveredFeature}
          onHoverEnd={() => setHoveredFeature(null)}
          onFeatureClick={handleFeatureSelect}
        />
      </main>
    </div>
  )
}
