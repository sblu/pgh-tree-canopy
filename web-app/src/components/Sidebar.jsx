import { useMemo, useState } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS, TREE_LOSS_COLORS, TREE_GAIN_COLORS, STREET_BUFFER_COLOR, CANOPY_CHANGE_COLORS } from '../config/layers'
import Leaderboard from './Leaderboard'

/**
 * Sidebar — all map controls and legend.
 * Pure presentational; all state lives in App.jsx.
 */
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
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

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

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <img src="images/shuc-logo.png" alt="SHUC logo" className="sidebar-logo" />
        <div>
          <div className="sidebar-title">Pittsburgh Tree Canopy</div>
          <div className="sidebar-subtitle">2015–2020 Change</div>
        </div>
      </header>

      {/* My Location */}
      <section className="sidebar-section">
        <div className="locate-row">
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
            <input
              type="checkbox"
              className="toggle-input"
              checked={showLocation}
              onChange={e => onShowLocationChange(e.target.checked)}
              disabled={!locationAvailable}
            />
            <span className="toggle-pill" />
          </label>
        </div>
      </section>

      {/* Boundary layer switcher */}
      <section className="sidebar-section">
        <div className="section-label">Layers</div>
        {BOUNDARY_LAYERS.map(layer => (
          <label key={layer.id} className="radio-row">
            <input
              type="radio"
              name="boundary"
              value={layer.id}
              checked={activeBoundaryLayerId === layer.id}
              onChange={() => onBoundaryLayerChange(layer.id)}
            />
            <span>
              {layer.label}
              {layer.description && <span className="radio-description">{layer.description}</span>}
            </span>
          </label>
        ))}
      </section>

      {/* Search */}
      {activeLayer?.file && (
        <section className="sidebar-section">
          <div className="section-label">Search</div>
          <div className="search-container">
            <input
              className="search-input"
              type="text"
              placeholder={activeLayer?.searchPlaceholder ?? 'Search…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            />
            {searchFocused && filteredNames.length > 0 && (
              <ul className="search-results">
                {filteredNames.map(name => (
                  <li key={name} onMouseDown={() => handleSelect(name)}>
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Color metric selector */}
      {activeLayer?.file && (
        <section className="sidebar-section">
          <div className="section-label">Color By</div>
          {COLOR_METHODS.filter(m => m.group === 'coverage').map(method => (
            <label key={method.id} className="radio-row">
              <input
                type="radio"
                name="method"
                value={method.id}
                checked={activeMethodId === method.id}
                onChange={() => onMethodChange(method.id)}
              />
              <span>
                {method.label}
                <span className="radio-description">{method.description}</span>
              </span>
            </label>
          ))}
          <div className="section-label" style={{ marginTop: '10px' }}>Net Change Metric</div>
          {COLOR_METHODS.filter(m => m.group === 'net_change').map(method => (
            <label key={method.id} className="radio-row">
              <input
                type="radio"
                name="method"
                value={method.id}
                checked={activeMethodId === method.id}
                onChange={() => onMethodChange(method.id)}
              />
              <span>
                {method.label}
                <span className="radio-description">{method.description}</span>
              </span>
            </label>
          ))}
        </section>
      )}

      {/* Leaderboard */}
      {activeLayer?.file && (
        <Leaderboard
          layerData={layerData}
          activeMethodId={activeMethodId}
          onHover={onHover}
          onHoverEnd={onHoverEnd}
          onFeatureSelect={onFeatureSelect}
        />
      )}

      {/* Detailed Zoom Settings */}
      <section className="sidebar-section">
        <div className="section-label">
          <svg className="section-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492ZM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0Z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a1.873 1.873 0 0 1-2.255 1.254l-.307-.1c-1.716-.56-3.137 1.467-2.014 2.875l.195.245a1.873 1.873 0 0 1-.39 2.564l-.26.19c-1.453 1.064-.636 3.338 1.16 3.226l.326-.02a1.873 1.873 0 0 1 1.945 1.554l.06.322c.33 1.775 2.893 1.967 3.486.262l.104-.3a1.873 1.873 0 0 1 2.378-1.108l.3.106c1.69.593 3.028-1.49 1.848-2.87l-.203-.238a1.873 1.873 0 0 1 .264-2.582l.252-.198c1.411-1.11.49-3.37-1.307-3.208l-.325.028a1.873 1.873 0 0 1-2.02-1.44l-.068-.323ZM8 10.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"/></svg>
          Detailed Zoom Settings
        </div>
        <div className="display-group">
          <label className="toggle-row">
            <span>
              Show mature tree losses
              <span className="radio-description">Red polygons at zoom 12+</span>
            </span>
            <input
              type="checkbox"
              className="toggle-input"
              checked={showTreeLosses}
              onChange={e => onShowTreeLossesChange(e.target.checked)}
            />
            <span className="toggle-pill" />
          </label>
          <label className="toggle-row">
            <span>
              Show significant gains
              <span className="radio-description">Green polygons at zoom 12+</span>
            </span>
            <input
              type="checkbox"
              className="toggle-input"
              checked={showTreeGains}
              onChange={e => onShowTreeGainsChange(e.target.checked)}
            />
            <span className="toggle-pill" />
          </label>
          <label className="toggle-row">
            <span>
              Show only street tree areas
              <span className="radio-description">Filter to 50 ft buffer around City of Pittsburgh streets</span>
            </span>
            <input
              type="checkbox"
              className="toggle-input"
              checked={showStreetBuffer}
              onChange={e => onShowStreetBufferChange(e.target.checked)}
            />
            <span className="toggle-pill" />
          </label>
        </div>
        <label className="toggle-row" style={{ marginTop: '8px', paddingLeft: '10px', paddingRight: '10px' }}>
          <span>
            Show all canopy changes
            <span className="radio-description">Gain, loss, no change at zoom 12+</span>
          </span>
          <input
            type="checkbox"
            className="toggle-input"
            checked={showCanopyChange}
            onChange={e => onShowCanopyChangeChange(e.target.checked)}
          />
          <span className="toggle-pill" />
        </label>
      </section>

      {/* Legend */}
      <section className="sidebar-section">
        {activeLayer?.file && (
          <>
            <div className="section-label">
              Legend — {isCoverage ? 'Canopy Coverage (2020)' : 'Net Canopy Change'}
            </div>
            {legendSteps.map(({ color, label }) => (
              <div key={label} className="legend-row">
                <span className="legend-swatch" style={{ background: color }} />
                {label}
              </div>
            ))}
          </>
        )}

        {showTreeLosses && (
          <>
            <div className="section-label" style={{ marginTop: '12px' }}>Mature Tree Losses</div>
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
            <div className="section-label" style={{ marginTop: showTreeLosses ? '8px' : '12px' }}>Gains</div>
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

        {(showTreeLosses || showTreeGains) && (
          <div className="legend-note">Visible at zoom level 12+</div>
        )}

        {showStreetBuffer && (
          <>
            <div className="section-label" style={{ marginTop: '12px' }}>Street Buffer</div>
            <div className="legend-row">
              <span className="legend-swatch" style={{ background: STREET_BUFFER_COLOR, opacity: 0.3 }} />
              50 ft road buffer
            </div>
          </>
        )}

        {showCanopyChange && (
          <>
            <div className="section-label" style={{ marginTop: '12px' }}>All Canopy Change</div>
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
            <div className="legend-note">Visible at zoom level 12+</div>
          </>
        )}
      </section>

      <footer className="sidebar-footer">
        Canopy data: Western PA Conservancy · 2015–2020<br />
        Data analysis:{' '}
        <a href="https://github.com/sblu/pgh-tree-canopy" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </aside>
  )
}
