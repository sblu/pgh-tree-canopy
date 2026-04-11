import { useEffect, useRef, useState, useMemo } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS } from '../config/layers'
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
  // Leaderboard
  onHover,
  onHoverEnd,
  // Legend
  colorBreaks,
}) {
  const wrapperRef = useRef(null)
  const searchRef  = useRef(null)
  const dragStartY      = useRef(0)
  const dragStartHeight = useRef(0)
  const isDragging      = useRef(false)

  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)

  // Auto-focus search when sheet expands
  useEffect(() => {
    if (sheetState === 'expanded') {
      setTimeout(() => searchRef.current?.focus(), 300)
    }
  }, [sheetState])

  // Touch drag/snap (identical logic from App.jsx)
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handle = wrapper.querySelector('.sheet-drag-handle')
    if (!handle) return

    const onTouchStart = e => {
      if (e.target.closest('button, a, input')) return
      dragStartY.current      = e.touches[0].clientY
      dragStartHeight.current = wrapper.getBoundingClientRect().height
      isDragging.current      = false
      wrapper.style.transition = 'none'
    }
    const onTouchMove = e => {
      const deltaY = dragStartY.current - e.touches[0].clientY
      if (Math.abs(deltaY) > 10) isDragging.current = true
      const newH = Math.max(60, Math.min(window.innerHeight * 0.95, dragStartHeight.current + deltaY))
      wrapper.style.maxHeight = `${newH}px`
    }
    const onTouchEnd = e => {
      if (e.target.closest('button, a, input')) return
      wrapper.style.transition = ''
      wrapper.style.maxHeight  = ''
      if (!isDragging.current) {
        onSheetStateChange(s => s === 'peek' ? 'expanded' : 'peek')
        return
      }
      const finalH = wrapper.getBoundingClientRect().height
      const vh = window.innerHeight
      if      (finalH < vh * 0.15) onSheetStateChange('peek')
      else if (finalH < vh * 0.70) onSheetStateChange('expanded')
      else                          onSheetStateChange('full')
    }

    handle.addEventListener('touchstart', onTouchStart, { passive: true })
    handle.addEventListener('touchmove',  onTouchMove,  { passive: true })
    handle.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      handle.removeEventListener('touchstart', onTouchStart)
      handle.removeEventListener('touchmove',  onTouchMove)
      handle.removeEventListener('touchend',   onTouchEnd)
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
    setQuery('')
    setFocused(false)
  }

  const showResults = focused && filtered.length > 0 && !selectedFeatureName

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
          <div className="panel-section-heading">Controls</div>
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
          />

          {/* Leaderboard (reuse LeaderboardPanel in inline mode) */}
          <div className="panel-section-heading" style={{ marginTop: '18px' }}>Rankings</div>
          <LeaderboardPanel
            isOpen={true}
            layerData={layerData}
            activeMethodId={activeMethodId}
            selectedFeatureName={selectedFeatureName}
            onFeatureSelect={onFeatureSelect}
            onHover={onHover}
            onHoverEnd={onHoverEnd}
          />
        </div>
      )}
    </div>
  )
}
