import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BOUNDARY_LAYERS, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS,
  TREE_LOSS_COLORS, TREE_GAIN_COLORS, STREET_BUFFER_COLOR,
  CANOPY_CHANGE_COLORS, PROMPT_CARDS, CTA_LINKS, LOCAL_STORAGE_KEY,
} from '../config/layers'
import { trackEvent } from '../utils/analytics'
import Leaderboard from './Leaderboard'

export default function Sidebar({
  activeBoundaryLayerId,
  onBoundaryLayerChange,
  activeMethodId,
  onMethodChange,
  showTreeLosses,
  onShowTreeLossesChange,
  showTreeGains,
  onShowTreeGainsChange,
  showStreetBuffer,
  onShowStreetBufferChange,
  showCanopyChange,
  onShowCanopyChangeChange,
  layerData,
  colorBreaks,
  onFeatureSelect,
  onHover,
  onHoverEnd,
  showLocation,
  onShowLocationChange,
  userLocation,
  locationError,
  locationAvailable,
  onPanToLocation,
  // New progressive disclosure props
  explorationStage,
  currentZoom,
  advancedExpanded,
  onAdvancedToggle,
  ctaDismissed,
  onCtaDismiss,
  onCtaReshow,
  onReset,
  selectedFeatureName,
  onMobileSearchFocus,
  streetPath,
  onStreetPathStart,
  onShare,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchInputRef = useRef(null)

  const activeLayer = BOUNDARY_LAYERS.find(l => l.id === activeBoundaryLayerId)

  // Build sorted list of feature names for the search dropdown
  const featureNames = useMemo(() => {
    if (!layerData?.features) return []
    return layerData.features
      .map(f => f.properties?.[activeLayer?.nameField])
      .filter(Boolean)
      .sort()
  }, [layerData, activeLayer])

  const filteredNames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return featureNames
    return featureNames.filter(n => n.toLowerCase().includes(q))
  }, [featureNames, searchQuery])

  function handleSelect(name) {
    setSearchQuery('')
    setSearchFocused(false)
    onFeatureSelect(name)
    trackEvent('feature_select', { name, boundary_layer: activeBoundaryLayerId })
  }

  function focusSearch() {
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  function handleNeighborhoodLink() {
    if (streetPath) {
      onBoundaryLayerChange('neighborhoods')
    }
    focusSearch()
  }

  function handleStreetLink() {
    if (!streetPath) {
      onStreetPathStart()
    }
    focusSearch()
  }

  const activeMethod = COLOR_METHODS.find(m => m.id === activeMethodId)
  const isCoverage = activeMethod?.group === 'coverage'
  const paletteColors = isCoverage ? COVERAGE_COLORS : CHOROPLETH_COLORS

  // Legend: pair each colour with its break range
  const legendSteps = useMemo(() => {
    if (!colorBreaks.length) return []
    const fmtVal = isCoverage
      ? v => `${Number(v).toFixed(1)}`
      : v => { const n = Number(v).toFixed(1); return v >= 0 ? `+${n}` : `${n}` }
    const colors = isCoverage ? COVERAGE_COLORS : CHOROPLETH_COLORS
    const steps = []
    steps.push({ color: colors[0], label: `< ${fmtVal(colorBreaks[0])}%` })
    colorBreaks.forEach((b, i) => {
      const next = colorBreaks[i + 1]
      const color = colors[i + 1] ?? colors[colors.length - 1]
      steps.push({ color, label: next ? `${fmtVal(b)} to ${fmtVal(next)}%` : `> ${fmtVal(b)}%` })
    })
    return steps
  }, [colorBreaks, isCoverage])

  const isTouchDevice = useMemo(() => window.matchMedia('(hover: none)').matches, [])
  const clickOrTap = isTouchDevice ? 'Tap' : 'Click'

  const [hasVisited, setHasVisited] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      return raw ? JSON.parse(raw).hasVisited === true : false
    } catch { return false }
  })

  // Re-show the landing card when the user resets
  useEffect(() => {
    if (explorationStage === 'landing') setHasVisited(false) // eslint-disable-line react-hooks/set-state-in-effect
  }, [explorationStage])

  // Build the neighborhood insight card dynamically
  const neighborhoodCard = useMemo(() => {
    if (!selectedFeatureName || !layerData?.features) return null
    const feature = layerData.features.find(f => f.properties?.name === selectedFeatureName)
    if (!feature) return null
    const p = feature.properties
    const method = COLOR_METHODS.find(m => m.id === activeMethodId)
    const isCoverageMetric = method?.group === 'coverage'
    const value = p[activeMethodId]
    if (value == null) return null
    const isLoss = !isCoverageMetric && value < 0
    return {
      headline: selectedFeatureName,
      stat: isCoverageMetric ? `${value.toFixed(1)}%` : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
      statColor: isCoverageMetric ? 'var(--sidebar-text)' : (isLoss ? '#f87171' : 'var(--accent)'),
      statLabel: method?.description || '',
      isLoss,
      isCoverage: isCoverageMetric,
    }
  }, [selectedFeatureName, layerData, activeMethodId])

  const showAtStreetLevel = currentZoom >= 12

  return (
    <aside className="sidebar">
      <div className="sheet-drag-handle">
        <div className="sheet-drag-handle-bar" />
      </div>
      {/* ── Header ── */}
      <header className="sidebar-header">
        <div className="sidebar-header-top">
          <a href="https://shuc.org/about-us/committees/parks-and-open-space-committee/"
            onClick={() => trackEvent('cta_click', { link: 'shuc_logo' })}>
            <img src="images/shuc-logo.png" alt="SHUC logo" className="sidebar-logo" />
          </a>
          <div>
            <div className="sidebar-title">Pittsburgh Tree Canopy Explorer</div>
            <div className="sidebar-subtitle">Based on 2015 to 2020 canopy changes</div>
          </div>
        </div>
        <div className="sidebar-header-tagline"><em>Brought to you by the Squirrel Hill Urban Coalition Tree Committee</em></div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'center', marginLeft: 'auto', marginRight: 'auto' }}>
          {onShare && (
            <button className="reset-btn" onClick={async () => {
              const ok = await onShare()
              if (ok) {
                const btn = document.querySelector('.share-toast')
                if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = '' }, 2000) }
              }
            }} title="Copy shareable link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle'}}><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              {' Share'}
              <span className="share-toast" style={{ fontSize: '10px', marginLeft: '2px' }}></span>
            </button>
          )}
          <button className="reset-btn" onClick={onReset} title="Start over">↺ Reset</button>
        </div>
      </header>

      {/* ── Search ── */}
      <section className="sidebar-section">
        <div className="section-label">
          {selectedFeatureName ? (activeLayer?.label || 'Selected') : `Find Your ${activeLayer?.singularLabel || 'Neighborhood'}`}
        </div>
        <div className="search-container">
          {selectedFeatureName ? (
            <div
              className="search-selected"
              onClick={() => { onFeatureSelect(null); setSearchQuery('') }}
            >
              {selectedFeatureName} <span className="search-clear">&times;</span>
            </div>
          ) : (
            <input
              ref={searchInputRef}
              className="search-input"
              type="text"
              placeholder={activeLayer?.searchPlaceholder ?? 'Search…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { setSearchFocused(true); if (onMobileSearchFocus) onMobileSearchFocus() }}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            />
          )}
          {searchFocused && !selectedFeatureName && filteredNames.length > 0 && (
            <ul className="search-results">
              {filteredNames.map(name => (
                <li
                  key={name}
                  onMouseDown={() => handleSelect(name)}
                  onTouchEnd={e => { e.preventDefault(); handleSelect(name) }}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Prompt Card ── */}
      {explorationStage === 'landing' && !hasVisited && (
        <div className="prompt-card" style={{ borderLeftColor: PROMPT_CARDS.landing.borderColor }}>
          <div className="prompt-headline">{PROMPT_CARDS.landing.headline}</div>
          <div className="prompt-body">{PROMPT_CARDS.landing.body}</div>
          <div className="prompt-action" style={{ marginTop: '8px' }}>
            <span
              role="button"
              tabIndex={0}
              onClick={handleNeighborhoodLink}
              onKeyDown={e => e.key === 'Enter' && handleNeighborhoodLink()}
              style={{ cursor: 'pointer', textDecoration: streetPath ? 'underline' : 'none', fontWeight: streetPath ? 'normal' : 600 }}
            >
              Find your neighborhood
            </span>
            {' or '}
            <span
              role="button"
              tabIndex={0}
              onClick={handleStreetLink}
              onKeyDown={e => e.key === 'Enter' && handleStreetLink()}
              style={{ cursor: 'pointer', textDecoration: streetPath ? 'none' : 'underline', fontWeight: streetPath ? 600 : 'normal' }}
            >
              find your street
            </span>
          </div>
        </div>
      )}

      {explorationStage === 'neighborhood' && neighborhoodCard && (
        <div className="prompt-card" style={{ borderLeftColor: neighborhoodCard.isLoss ? '#f87171' : 'var(--accent)' }}>
          <div className="prompt-headline">{neighborhoodCard.headline}</div>
          <div className="prompt-body">
            {neighborhoodCard.isCoverage ? (
              <>
                Has{' '}
                <span style={{ color: neighborhoodCard.statColor, fontWeight: 600 }}>
                  {neighborhoodCard.stat}
                </span>
                {' canopy coverage (2020).'}
              </>
            ) : (
              <>
                {neighborhoodCard.isLoss ? 'Lost ' : 'Gained '}
                <span style={{ color: neighborhoodCard.statColor, fontWeight: 600 }}>
                  {neighborhoodCard.stat}
                </span>
                {' of its canopy between 2015–2020.'}
              </>
            )}
            <br />
            <span className="prompt-hint">{neighborhoodCard.statLabel}</span>
          </div>
          <div className="prompt-action">Zoom in to see where individual mature trees were lost →</div>
        </div>
      )}

      {explorationStage === 'street-level' && !streetPath && (
        <div className="prompt-card" style={{ borderLeftColor: PROMPT_CARDS['street-level'].borderColor }}>
          <div className="prompt-headline">{PROMPT_CARDS['street-level'].headline}</div>
          <div className="prompt-body">
            Each <span style={{ color: '#e74c3c' }}>■</span> red shape is a mature tree lost between 2015–2020.
            <br />
            <strong>{clickOrTap} one to see the before &amp; after Street View.</strong>
          </div>
        </div>
      )}

      {/* ── Leaderboard (appears at neighborhood stage or later) ── */}
      {explorationStage !== 'landing' && activeLayer?.file && (
        <Leaderboard
          layerData={layerData}
          activeMethodId={activeMethodId}
          onHover={onHover}
          onHoverEnd={onHoverEnd}
          onFeatureSelect={onFeatureSelect}
          defaultOpen={explorationStage === 'neighborhood'}
          label="How Others Compare"
        />
      )}

      {/* ── CTA Section ── */}
      {!ctaDismissed ? (
        <div className="cta-prominent">
          <div className="cta-prominent-title">Help Restore Pittsburgh's Canopy</div>
          <div className="cta-prominent-body">
            Every tree matters. Here's how you can make a difference in Squirrel Hill:
          </div>
          <div className="cta-actions">
            {Object.values(CTA_LINKS).map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="cta-action-btn"
                onClick={() => trackEvent('cta_click', { link: link.label })}>
                <span className="cta-action-emoji">{link.emoji}</span>
                <div>
                  <div className="cta-action-label">{link.label} <span className="cta-external-icon">↗</span></div>
                  <div className="cta-action-desc">{link.description}</div>
                </div>
              </a>
            ))}
          </div>
          <button className="cta-dismiss" onClick={onCtaDismiss}>Dismiss</button>
        </div>
      ) : (
        <div className="cta-subtle">
          <span className="cta-subtle-emoji">🌱</span>
          <span className="cta-subtle-text">
            Want to help?{' '}
            <a
              href="#"
              onClick={e => { e.preventDefault(); onCtaReshow(); trackEvent('cta_click', { link: 'reshow_how_to_help' }) }}
            >
              Learn how you can take action in Squirrel Hill
            </a>
          </span>
        </div>
      )}

      {/* ── Dynamic Legend ── */}
      <section className="sidebar-section">
        <div className="section-label">
          {isCoverage ? 'Canopy Coverage by Boundary' : 'Net Canopy Change by Boundary'}
          {!isCoverage && (
            <span className="section-label-sub">
              {activeMethodId === 'net_pct_of_area' ? '(% of area)' : '(% of 2015 canopy)'}
            </span>
          )}
        </div>
        <select
          className="boundary-select"
          value={activeBoundaryLayerId}
          onChange={e => { onBoundaryLayerChange(e.target.value); trackEvent('boundary_layer_change', { layer: e.target.value }) }}
        >
          {BOUNDARY_LAYERS.map(layer => (
            <option key={layer.id} value={layer.id}>
              {layer.label}{layer.description ? ` — ${layer.description}` : ''}
            </option>
          ))}
        </select>

        {activeLayer?.file && (
          <>
            {explorationStage === 'landing' && !advancedExpanded ? (
              <div className="legend-gradient-bar">
                <div className="legend-gradient-colors">
                  {paletteColors.map((c, i) => (
                    <div key={i} style={{ background: c, flex: 1 }} />
                  ))}
                </div>
                <div className="legend-gradient-labels">
                  <span>{isCoverage ? 'Low' : 'Loss'}</span>
                  <span>{isCoverage ? 'High' : 'Gain'}</span>
                </div>
              </div>
            ) : (
              legendSteps.map(({ color, label }) => (
                <div key={label} className="legend-row">
                  <span className="legend-swatch" style={{ background: color }} />
                  {label}
                </div>
              ))
            )}
          </>
        )}

        {(showTreeLosses || showTreeGains) && (
          <>
            <div className="section-label" style={{ marginTop: '12px' }}>
              {showTreeLosses && showTreeGains
                ? 'Tree Losses and Gains'
                : showTreeGains
                  ? 'Tree Gains'
                  : 'Tree Losses'}
            </div>
            {showAtStreetLevel ? (
              <>
                {showTreeLosses && (
                  <>
                    <div className="legend-row">
                      <span className="legend-swatch" style={{ background: TREE_LOSS_COLORS.tree }} />
                      Single tree ≥ 0.04 acres
                    </div>
                    <div className="legend-row">
                      <span className="legend-swatch" style={{ background: TREE_LOSS_COLORS.grove }} />
                      Grove ≥ 0.07 acres
                    </div>
                  </>
                )}
                {showTreeGains && (
                  <>
                    <div className="legend-row">
                      <span className="legend-swatch" style={{ background: TREE_GAIN_COLORS.tree }} />
                      Medium gain ≥ 0.04 acres
                    </div>
                    <div className="legend-row">
                      <span className="legend-swatch" style={{ background: TREE_GAIN_COLORS.grove }} />
                      Large gain ≥ 0.07 acres
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="legend-note">Zoom in to see this data</div>
            )}
          </>
        )}

        {showStreetBuffer && showAtStreetLevel && (
          <div className="legend-row" style={{ marginTop: '12px' }}>
            <span className="legend-swatch" style={{ background: STREET_BUFFER_COLOR, opacity: 0.3 }} />
            Street tree area
          </div>
        )}

        {showCanopyChange && (
          <>
            <div className="section-label" style={{ marginTop: '12px' }}>All Canopy Change</div>
            {showAtStreetLevel ? (
              <>
                <div className="legend-row">
                  <span className="legend-swatch" style={{ background: CANOPY_CHANGE_COLORS.no_change }} />
                  No change (2015–2020)
                </div>
                <div className="legend-row">
                  <span className="legend-swatch" style={{ background: CANOPY_CHANGE_COLORS.gain }} />
                  Canopy gain
                </div>
                <div className="legend-row">
                  <span className="legend-swatch" style={{ background: CANOPY_CHANGE_COLORS.loss }} />
                  Canopy loss
                </div>
              </>
            ) : (
              <div className="legend-note">Zoom in to see this data</div>
            )}
          </>
        )}
      </section>

      {/* ── Viewing Options ── */}
      <section className="advanced-zone">
        <button
          className="advanced-toggle"
          onClick={() => onAdvancedToggle(!advancedExpanded)}
        >
          <span className="advanced-toggle-icon">⚙</span>
          <span>Viewing Options</span>
          <span className="advanced-chevron">{advancedExpanded ? '▾' : '▸'}</span>
        </button>

        {advancedExpanded && (
          <div className="advanced-content">
            {/* Color metric selector */}
            <div className="advanced-sub">
              <div className="section-label">Color By</div>
              {COLOR_METHODS.map(method => (
                <label key={method.id} className="radio-row">
                  <input
                    type="radio"
                    name="method"
                    value={method.id}
                    checked={activeMethodId === method.id}
                    onChange={() => { onMethodChange(method.id); trackEvent('color_method_change', { method: method.id }) }}
                  />
                  <span>
                    {method.label}
                    <span className="radio-description">{method.description}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Map layer toggles */}
            <div className="advanced-sub">
              <div className="section-label">Viewing Options</div>
              <label className={`toggle-row${!locationAvailable ? ' disabled' : ''}`}>
                <span className="locate-label">
                  My Location
                  <span
                    className={`locate-dot${userLocation ? ' active' : ''}`}
                    role="button"
                    tabIndex={userLocation ? 0 : -1}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); if (userLocation) onPanToLocation() }}
                    title={userLocation ? 'Pan to my location' : 'Enable location first'}
                  />
                  {locationError && <span className="radio-description" style={{ color: '#f87171' }}>{locationError}</span>}
                  {!locationAvailable && !locationError && <span className="radio-description">Requires HTTPS</span>}
                </span>
                <input type="checkbox" className="toggle-input"
                  checked={showLocation} onChange={e => onShowLocationChange(e.target.checked)} disabled={!locationAvailable} />
                <span className="toggle-pill" />
              </label>
              <label className="toggle-row">
                <span>Mature tree losses</span>
                <input type="checkbox" className="toggle-input"
                  checked={showTreeLosses} onChange={e => { onShowTreeLossesChange(e.target.checked); trackEvent('layer_toggle', { layer: 'tree_losses', enabled: e.target.checked }) }} />
                <span className="toggle-pill" />
              </label>
              <label className="toggle-row">
                <span>Significant gains</span>
                <input type="checkbox" className="toggle-input"
                  checked={showTreeGains} onChange={e => { onShowTreeGainsChange(e.target.checked); trackEvent('layer_toggle', { layer: 'tree_gains', enabled: e.target.checked }) }} />
                <span className="toggle-pill" />
              </label>
              <label className="toggle-row">
                <span>Street tree areas only<span className="toggle-subtext">Limits to City of Pittsburgh only</span></span>
                <input type="checkbox" className="toggle-input"
                  checked={showStreetBuffer} onChange={e => { onShowStreetBufferChange(e.target.checked); trackEvent('layer_toggle', { layer: 'street_buffer', enabled: e.target.checked }) }} />
                <span className="toggle-pill" />
              </label>
              <label className="toggle-row">
                <span>All canopy changes</span>
                <input type="checkbox" className="toggle-input"
                  checked={showCanopyChange} onChange={e => { onShowCanopyChangeChange(e.target.checked); trackEvent('layer_toggle', { layer: 'canopy_change', enabled: e.target.checked }) }} />
                <span className="toggle-pill" />
              </label>
            </div>
          </div>
        )}
      </section>

      <footer className="sidebar-footer">
        Canopy data: Western PA Conservancy · 2015–2020<br />
        Data analysis and web app:{' '}
        <a href="https://github.com/sblu/pgh-tree-canopy" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <br />
        <span className="build-tag">Build: {__BUILD_TAG__}</span>
      </footer>
    </aside>
  )
}
