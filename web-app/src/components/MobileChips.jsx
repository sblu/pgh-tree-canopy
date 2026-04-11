import { useState } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS } from '../config/layers'

const CHIP_LABELS = {
  neighborhoods:   'Hoods',
  city_council:    'City Council',
  county_council:  'County Council',
  parks_municipal: 'City Parks',
  parks_county:    'County Parks',
  municipalities:  'Municipalities',
  streets:         'Streets',
}

const METHOD_SHORT = {
  canopy_2020_pct:        '2020 Canopy',
  net_pct_of_area:        'Net / Area',
  net_pct_of_2015_canopy: 'Net / 2015',
}

export default function MobileChips({
  activeBoundaryLayerId,
  onBoundaryLayerChange,
  activeMethodId,
  onMethodChange,
  showTreeLosses,
  onShowTreeLossesChange,
  showTreeGains,
  onShowTreeGainsChange,
}) {
  const [openDropdown, setOpenDropdown] = useState(null) // 'boundary' | 'metric' | null

  function toggleDropdown(name) {
    setOpenDropdown(d => d === name ? null : name)
  }

  function selectBoundary(id) {
    onBoundaryLayerChange(id)
    setOpenDropdown(null)
  }

  function selectMethod(id) {
    onMethodChange(id)
    setOpenDropdown(null)
  }

  const visibleLayers = BOUNDARY_LAYERS.filter(l => l.id !== 'none')
  const activeLayerLabel = CHIP_LABELS[activeBoundaryLayerId] ?? activeBoundaryLayerId
  const activeMethodShort = METHOD_SHORT[activeMethodId] ?? activeMethodId

  return (
    <>
      <div className="mobile-chips-row">
        {/* Boundary picker chip */}
        <button
          className={`mobile-chip${openDropdown === 'boundary' ? ' mobile-chip--active-green' : ''}`}
          onClick={() => toggleDropdown('boundary')}
        >
          {activeLayerLabel} ▾
        </button>

        {/* Metric picker chip */}
        <button
          className={`mobile-chip${openDropdown === 'metric' ? ' mobile-chip--active-green' : ''}`}
          onClick={() => toggleDropdown('metric')}
        >
          {activeMethodShort} ▾
        </button>

        {/* Losses toggle chip */}
        <button
          className={`mobile-chip${showTreeLosses ? ' mobile-chip--active-amber' : ''}`}
          onClick={() => onShowTreeLossesChange(!showTreeLosses)}
        >
          {showTreeLosses ? '● ' : '○ '}Losses
        </button>

        {/* Gains toggle chip */}
        <button
          className={`mobile-chip${showTreeGains ? ' mobile-chip--active-green' : ''}`}
          onClick={() => onShowTreeGainsChange(!showTreeGains)}
        >
          {showTreeGains ? '● ' : '○ '}Gains
        </button>
      </div>

      {/* Boundary dropdown */}
      {openDropdown === 'boundary' && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setOpenDropdown(null)}
          />
          <div className="chip-dropdown">
            {visibleLayers.map(l => (
              <div
                key={l.id}
                className={`chip-dropdown-item${activeBoundaryLayerId === l.id ? ' chip-dropdown-item--active' : ''}`}
                onClick={() => selectBoundary(l.id)}
              >
                {l.label}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Metric dropdown */}
      {openDropdown === 'metric' && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setOpenDropdown(null)}
          />
          <div className="chip-dropdown" style={{ left: '130px' }}>
            {COLOR_METHODS.map(m => (
              <div
                key={m.id}
                className={`chip-dropdown-item${activeMethodId === m.id ? ' chip-dropdown-item--active' : ''}`}
                onClick={() => selectMethod(m.id)}
              >
                {m.label}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
