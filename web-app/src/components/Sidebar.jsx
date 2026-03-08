import { useMemo, useState } from 'react'
import { BOUNDARY_LAYERS, LOSS_METHODS, CHOROPLETH_COLORS, TREE_LOSS_COLORS, STREET_BUFFER_COLOR } from '../config/layers'

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
  showStreetBuffer,
  onShowStreetBufferChange,
  layerData,
  colorBreaks,
  onFeatureSelect,
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

  // Legend: pair each colour with its break range
  const legendSteps = useMemo(() => {
    if (!colorBreaks.length) return []
    const steps = []
    steps.push({ color: CHOROPLETH_COLORS[0], label: `0 – ${colorBreaks[0]}%` })
    colorBreaks.forEach((b, i) => {
      const next = colorBreaks[i + 1]
      const color = CHOROPLETH_COLORS[i + 1] ?? CHOROPLETH_COLORS[CHOROPLETH_COLORS.length - 1]
      steps.push({ color, label: next ? `${b} – ${next}%` : `> ${b}%` })
    })
    return steps
  }, [colorBreaks])

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

      {/* Loss metric toggle */}
      <section className="sidebar-section">
        <div className="section-label">Loss Metric</div>
        {LOSS_METHODS.map(method => (
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
            <span className="radio-description">Zoom in past level 14 to see</span>
          </span>
        </label>
        <label className="radio-row">
          <input
            type="checkbox"
            checked={showStreetBuffer}
            onChange={e => onShowStreetBufferChange(e.target.checked)}
          />
          <span>
            Show street tree buffer area
            <span className="radio-description">50 ft buffer around all streets</span>
          </span>
        </label>
      </section>

      {/* Legend */}
      <section className="sidebar-section">
        <div className="section-label">Legend — Canopy Loss</div>
        {legendSteps.map(({ color, label }) => (
          <div key={label} className="legend-row">
            <span className="legend-swatch" style={{ background: color }} />
            {label}
          </div>
        ))}

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
            <div className="legend-note">Visible at zoom level 14+</div>
          </>
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
