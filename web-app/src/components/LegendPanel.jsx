import { useMemo } from 'react'
import { CHOROPLETH_COLORS, COVERAGE_COLORS, COLOR_METHODS } from '../config/layers'

export default function LegendPanel({ colorBreaks, activeMethodId, isCoverage, inline = false }) {
  const method = COLOR_METHODS.find(m => m.id === activeMethodId)

  const steps = useMemo(() => {
    if (!colorBreaks.length) return []
    const colors = isCoverage ? COVERAGE_COLORS : CHOROPLETH_COLORS
    const fmt = isCoverage
      ? v => `${Number(v).toFixed(1)}`
      : v => { const n = Number(v).toFixed(1); return Number(v) >= 0 ? `+${n}` : `${n}` }
    const result = []
    result.push({ color: colors[0], label: `< ${fmt(colorBreaks[0])}%` })
    colorBreaks.forEach((b, i) => {
      const next = colorBreaks[i + 1]
      const color = colors[i + 1] ?? colors[colors.length - 1]
      result.push({ color, label: next ? `${fmt(b)} to ${fmt(next)}%` : `> ${fmt(b)}%` })
    })
    return result
  }, [colorBreaks, isCoverage])

  if (!steps.length) return null

  return (
    <div className={`legend-panel${inline ? ' legend-panel--inline' : ''}`}>
      <div className="legend-title">{method?.label ?? 'Legend'}</div>
      {steps.map((s, i) => (
        <div key={i} className="legend-row">
          <div className="legend-swatch" style={{ background: s.color }} />
          <span className="legend-label">{s.label}</span>
        </div>
      ))}
      <div className="legend-attribution">
        Canopy data: <a href="https://www.treepittsburgh.org" target="_blank" rel="noopener noreferrer">Tree Pittsburgh</a>
        <br/>
        Address search: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        <br/>
        Visualization: <a href="https://github.com/sblu/pgh-tree-canopy" target="_blank" rel="noopener noreferrer">GitHub</a>
        <br/>
        Build: {__BUILD_TAG__}
      </div>
    </div>
  )
}
