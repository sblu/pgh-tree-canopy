import { useState, useMemo } from 'react'
import { BOUNDARY_LAYERS, STREET_BUFFER_PATH } from './config/layers'
import { useLayerData, computeQuantileBreaks } from './hooks/useLayerData'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import './index.css'

export default function App() {
  const [activeBoundaryLayerId, setActiveBoundaryLayerId] = useState('neighborhoods')
  const [activeMethodId, setActiveMethodId]               = useState('loss_pct_of_area')
  const [showTreeLosses, setShowTreeLosses]               = useState(true)
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

  // Recompute colour breaks when layer data or active metric changes
  const colorBreaks = useMemo(
    () => computeQuantileBreaks(layerData, activeMethodId),
    [layerData, activeMethodId]
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
        showStreetBuffer={showStreetBuffer}
        onShowStreetBufferChange={setShowStreetBuffer}
        layerData={layerData}
        colorBreaks={colorBreaks}
        onFeatureSelect={handleFeatureSelect}
      />

      <main className="map-container">
        {loading && <div className="map-status">Loading layer data…</div>}
        {error   && <div className="map-status error">Error: {error}</div>}

        <MapView
          layerData={layerData}
          activeMethodId={activeMethodId}
          colorBreaks={colorBreaks}
          showTreeLosses={showTreeLosses}
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
