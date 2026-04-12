import { useState } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS } from '../config/layers'
import { trackEvent } from '../utils/analytics'

// Short labels for the boundary layer chips
const CHIP_LABELS = {
  neighborhoods:   'Neighborhoods',
  city_council:    'City Council',
  county_council:  'County Council',
  parks_municipal: 'City Parks',
  parks_county:    'County Parks',
  municipalities:  'Municipalities',
  streets:         'Streets',
}

export default function ControlsPanel({
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
  inline = false,
}) {
  const [collapsed, setCollapsed] = useState(false)

  const visibleLayers = BOUNDARY_LAYERS.filter(l => l.id !== 'none')

  return (
    <div className={`controls-panel${inline ? ' controls-panel--inline' : ''}`}>
      <div className="controls-header">
        <div className="controls-title">Controls</div>
        <button
          className={`controls-chevron${collapsed ? '' : ' controls-chevron--open'}`}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand controls' : 'Collapse controls'}
        >
          ▾
        </button>
      </div>

      {!collapsed && (
        <div className="controls-body">
          {/* View By */}
          <div className="cp-section">
            <div className="cp-label">View By</div>
            <div className="cp-chips">
              {visibleLayers.map(l => (
                <button
                  key={l.id}
                  className={`cp-chip${activeBoundaryLayerId === l.id ? ' cp-chip--active' : ''}`}
                  onClick={() => { onBoundaryLayerChange(l.id); trackEvent('boundary_layer_change', { layer: l.id }) }}
                >
                  {CHIP_LABELS[l.id] ?? l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cp-sep" />

          {/* Color By */}
          <div className="cp-section">
            <div className="cp-label">Color By</div>
            {COLOR_METHODS.map(m => (
              <label key={m.id} className="cp-radio" onClick={() => { onMethodChange(m.id); trackEvent('color_method_change', { method: m.id }) }}>
                <div className={`cp-radio-dot${activeMethodId === m.id ? ' cp-radio-dot--active' : ''}`} />
                <span className={`cp-radio-label${activeMethodId === m.id ? ' cp-radio-label--active' : ''}`}>
                  {m.label}
                </span>
              </label>
            ))}
          </div>

          <div className="cp-sep" />

          {/* Overlays */}
          <div className="cp-section">
            <div className="cp-label">Overlays</div>
            {[
              { id: 'tree_losses',   label: 'Tree Losses',        value: showTreeLosses,   onChange: onShowTreeLossesChange },
              { id: 'tree_gains',    label: 'Tree Gains',         value: showTreeGains,    onChange: onShowTreeGainsChange },
              { id: 'street_buffer', label: 'Street Buffer Zone', value: showStreetBuffer, onChange: onShowStreetBufferChange },
              { id: 'canopy_change', label: 'Full Canopy Layer',  value: showCanopyChange, onChange: onShowCanopyChangeChange },
            ].map(({ id, label, value, onChange }) => (
              <div key={label} className="cp-toggle-row" onClick={() => { onChange(!value); trackEvent('layer_toggle', { layer: id, enabled: !value }) }}>
                <span className={`cp-toggle-label${value ? ' cp-toggle-label--active' : ''}`}>{label}</span>
                <div className={`cp-toggle${value ? ' cp-toggle--on' : ''}`}>
                  <div className="cp-toggle-knob" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
