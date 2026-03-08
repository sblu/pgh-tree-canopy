import { useMemo, useState } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS, TREE_LOSS_COLORS, TREE_GAIN_COLORS, STREET_BUFFER_COLOR } from '../config/layers'
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
  layerData,
  colorBreaks,
  onFeatureSelect,
  onHover,
  onHoverEnd,
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
        <img src="/images/shuc-logo.png" alt="SHUC logo" className="sidebar-logo" />
        <div>
          <div className="sidebar-title">Pittsburgh Tree Canopy</div>
          <div className="sidebar-subtitle">2015–2020 Change</div>
        </div>
      </header>

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
            {layer.label}
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

      {/* Display options */}
      <section className="sidebar-section">
        <div className="section-label">Display</div>
        <label className="radio-row">
          <input
            type="checkbox"
            checked={showTreeLosses}
            onChange={e => onShowTreeLossesChange(e.target.checked)}
          />
          <span>
            Show mature tree losses
            <span className="radio-description">Red polygons at zoom 14+</span>
          </span>
        </label>
        <label className="radio-row">
          <input
            type="checkbox"
            checked={showTreeGains}
            onChange={e => onShowTreeGainsChange(e.target.checked)}
          />
          <span>
            Show gains
            <span className="radio-description">Green polygons at zoom 14+</span>
          </span>
        </label>
        <label className="radio-row">
          <input
            type="checkbox"
            checked={showStreetBuffer}
            onChange={e => onShowStreetBufferChange(e.target.checked)}
          />
          <span>
            Show only street tree areas
            <span className="radio-description">Filter to 50 ft buffer around streets</span>
          </span>
        </label>
      </section>

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
              Single tree ≥ 0.04 ac
            </div>
            <div className="legend-row">
              <span className="legend-swatch" style={{ background: TREE_LOSS_COLORS.grove }} />
              Grove ≥ 0.07 ac
            </div>
          </>
        )}

        {showTreeGains && (
          <>
            <div className="section-label" style={{ marginTop: showTreeLosses ? '8px' : '12px' }}>Gains</div>
            <div className="legend-row">
              <span className="legend-swatch" style={{ background: TREE_GAIN_COLORS.tree }} />
              Medium gain ≥ 0.04 ac
            </div>
            <div className="legend-row">
              <span className="legend-swatch" style={{ background: TREE_GAIN_COLORS.grove }} />
              Large gain ≥ 0.07 ac
            </div>
          </>
        )}

        {(showTreeLosses || showTreeGains) && (
          <div className="legend-note">Visible at zoom level 14+</div>
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
