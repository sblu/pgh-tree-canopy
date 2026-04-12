import { useEffect, useRef, useState, useMemo } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS } from '../config/layers'
import { trackEvent } from '../utils/analytics'
import ControlsPanel from './ControlsPanel'
import LeaderboardPanel from './LeaderboardPanel'

export default function MobileSheet({
  sheetState,
  onSheetStateChange,
  // Selected boundary summary (peek content)
  selectedFeatureName,
  layerData,
  activeMethodId,
  isCoverage,
  // Search
  activeLayer,
  onFeatureSelect,
  // ControlsPanel props
  activeBoundaryLayerId,
  onBoundaryLayerChange,
  onMethodChange,
  showTreeLosses,
  onShowTreeLossesChange,
  showTreeGains,
  onShowTreeGainsChange,
  showStreetBuffer,
  onShowStreetBufferChange,
  showCanopyChange,
  onShowCanopyChangeChange,
  showLocation,
  onShowLocationChange,
  locationAvailable,
  locationError,
  // Leaderboard
  onHover,
  onHoverEnd,
}) {
  const wrapperRef = useRef(null)
  const searchRef  = useRef(null)
  const dragStartY      = useRef(0)
  const dragStartHeight = useRef(0)
  const isDragging      = useRef(false)
  // 'drag' | null
  const dragMode        = useRef(null)

  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)


  // Drag/snap using Pointer Events (avoids iOS passive-listener / touchcancel issues)
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onPointerDown = e => {
      const draggable = e.target.closest('.sheet-drag-handle, .sheet-peek-summary')
      if (!draggable) return
      if (e.target.closest('button, a, input')) return

      // Capture so all subsequent pointer events come here even if finger moves away
      wrapper.setPointerCapture(e.pointerId)
      dragStartY.current      = e.clientY
      dragStartHeight.current = wrapper.getBoundingClientRect().height
      isDragging.current      = false
      dragMode.current        = 'drag'
      wrapper.style.transition = 'none'
    }

    const onPointerMove = e => {
      if (dragMode.current !== 'drag') return
      const deltaY = dragStartY.current - e.clientY // positive = finger moved up
      const state  = wrapper.dataset.state || 'peek'

      if (state === 'peek') {
        // In peek state the expanded content isn't in the DOM so max-height can't
        // grow the sheet — snap to expanded as soon as the swipe is intentional.
        if (deltaY > 20) {
          dragMode.current = null
          wrapper.style.transition = ''
          onSheetStateChange('expanded')
        }
        return
      }

      // Expanded/full: let the user drag down to preview collapsing.
      // (Upward drags do nothing — content is already showing.)
      if (deltaY < -4) {
        isDragging.current = true
        const newH = Math.max(60, dragStartHeight.current + deltaY)
        wrapper.style.maxHeight = `${newH}px`
      }
    }

    const onPointerCancel = () => {
      dragMode.current   = null
      isDragging.current = false
      wrapper.style.transition = ''
      wrapper.style.maxHeight  = ''
    }

    const onPointerUp = e => {
      if (dragMode.current !== 'drag') { return }
      dragMode.current = null
      wrapper.style.transition = ''

      if (!isDragging.current) {
        // Tap on handle/peek-summary → toggle peek ↔ expanded
        wrapper.style.maxHeight = ''
        if (!e.target.closest('button, a, input')) {
          onSheetStateChange(s => s === 'peek' ? 'expanded' : 'peek')
        }
        return
      }
      isDragging.current = false

      const finalH      = wrapper.getBoundingClientRect().height
      wrapper.style.maxHeight = ''
      const vh          = window.innerHeight
      const draggedDown = dragStartHeight.current - finalH // positive = dragged downward

      // Collapse if the user dragged down more than 15% of viewport height
      if (draggedDown > vh * 0.15) {
        onSheetStateChange('peek')
      }
      // Otherwise restore the expanded/full state (no-op — CSS handles it)
    }

    wrapper.addEventListener('pointerdown',   onPointerDown)
    wrapper.addEventListener('pointermove',   onPointerMove)
    wrapper.addEventListener('pointerup',     onPointerUp)
    wrapper.addEventListener('pointercancel', onPointerCancel)
    return () => {
      wrapper.removeEventListener('pointerdown',   onPointerDown)
      wrapper.removeEventListener('pointermove',   onPointerMove)
      wrapper.removeEventListener('pointerup',     onPointerUp)
      wrapper.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [onSheetStateChange])

  const featureNames = useMemo(() => {
    if (!layerData?.features || !activeLayer?.nameField) return []
    return layerData.features
      .map(f => f.properties?.[activeLayer.nameField])
      .filter(Boolean)
      .sort()
  }, [layerData, activeLayer])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return featureNames
    return featureNames.filter(n => n.toLowerCase().includes(q))
  }, [featureNames, query])

  const method    = COLOR_METHODS.find(m => m.id === activeMethodId)
  const selFeature = layerData?.features?.find(f => f.properties?.name === selectedFeatureName)
  const selVal    = selFeature?.properties?.[activeMethodId]
  const selIsLoss = selVal != null && !isCoverage && selVal < 0

  function fmtVal(v) {
    if (v == null) return null
    const n = Number(v)
    if (isCoverage) return `${n.toFixed(1)}%`
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
  }

  function handleSearchSelect(name) {
    onFeatureSelect(name)
    trackEvent('feature_select', { name, boundary_layer: activeLayer?.id })
    setQuery('')
    setFocused(false)
    onSheetStateChange('peek')
  }

  const showResults = focused && query.trim().length > 0 && filtered.length > 0 && !selectedFeatureName

  return (
    <div className="mobile-sheet" data-state={sheetState} ref={wrapperRef}>
      <div className="sheet-drag-handle">
        <div className="sheet-drag-handle-bar" />
      </div>

      {/* Peek content: summary of selected boundary (or CTA) */}
      <div className="sheet-peek-summary">
        {selectedFeatureName && selFeature ? (
          <>
            <div className="sheet-peek-name">{selectedFeatureName}</div>
            <span className={`sheet-peek-stat ${selIsLoss ? 'sheet-peek-stat--amber' : 'sheet-peek-stat--green'}`}>
              {fmtVal(selVal)}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: '11px' }}> · {method?.label}</span>
          </>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Tap a zone on the map to explore · swipe up for controls
          </span>
        )}
      </div>

      {/* Expanded content */}
      {sheetState !== 'peek' && (
        <div className="sheet-expanded-content">
          {/* Search */}
          <div className="sheet-search-wrap">
            <div className="sheet-search-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
              </svg>
              {selectedFeatureName ? (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => { onFeatureSelect(null); setQuery('') }}
                >
                  {selectedFeatureName} <span style={{ opacity: 0.6 }}>✕</span>
                </button>
              ) : (
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  placeholder={activeLayer?.searchPlaceholder || 'Search…'}
                />
              )}
            </div>
            {showResults && (
              <div className="sheet-search-results">
                {filtered.map(name => (
                  <div key={name} className="search-result" onMouseDown={() => handleSearchSelect(name)}>
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls (reuse ControlsPanel in inline mode) */}
          <ControlsPanel
            inline
            activeBoundaryLayerId={activeBoundaryLayerId}
            onBoundaryLayerChange={onBoundaryLayerChange}
            activeMethodId={activeMethodId}
            onMethodChange={onMethodChange}
            showTreeLosses={showTreeLosses}
            onShowTreeLossesChange={onShowTreeLossesChange}
            showTreeGains={showTreeGains}
            onShowTreeGainsChange={onShowTreeGainsChange}
            showStreetBuffer={showStreetBuffer}
            onShowStreetBufferChange={onShowStreetBufferChange}
            showCanopyChange={showCanopyChange}
            onShowCanopyChangeChange={onShowCanopyChangeChange}
            showLocation={showLocation}
            onShowLocationChange={onShowLocationChange}
            locationAvailable={locationAvailable}
            locationError={locationError}
          />

          {/* Leaderboard (reuse LeaderboardPanel in inline mode) */}
          <div className="panel-section-heading" style={{ marginTop: '18px' }}>Rankings</div>
          <LeaderboardPanel
            isOpen={true}
            inline
            layerData={layerData}
            activeMethodId={activeMethodId}
            selectedFeatureName={selectedFeatureName}
            onFeatureSelect={onFeatureSelect}
            onHover={onHover}
            onHoverEnd={onHoverEnd}
          />

          <div className="legend-attribution" style={{ marginTop: '18px' }}>
            Canopy data: <a href="https://www.treepittsburgh.org" target="_blank" rel="noopener noreferrer">Tree Pittsburgh</a>
            &nbsp;·&nbsp;
            Visualization: <a href="https://github.com/sblu/pgh-tree-canopy" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      )}
    </div>
  )
}
