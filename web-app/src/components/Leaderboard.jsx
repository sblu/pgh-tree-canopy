import { useMemo, useState } from 'react'
import { COLOR_METHODS } from '../config/layers'

/**
 * Compute a rough centroid from a GeoJSON geometry's coordinates.
 */
function computeCentroid(geometry) {
  let sumLng = 0, sumLat = 0, count = 0
  const walk = coords => {
    if (typeof coords[0] === 'number') {
      sumLng += coords[0]
      sumLat += coords[1]
      count++
    } else {
      coords.forEach(walk)
    }
  }
  walk(geometry.coordinates)
  return count > 0
    ? { lng: sumLng / count, lat: sumLat / count }
    : { lng: 0, lat: 0 }
}

export default function Leaderboard({
  layerData,
  activeMethodId,
  onHover,
  onHoverEnd,
  onFeatureSelect,
}) {
  const [open, setOpen] = useState(true)
  const [sortAsc, setSortAsc] = useState(false) // false = highest first

  const method = COLOR_METHODS.find(m => m.id === activeMethodId)
  const isCoverage = method?.group === 'coverage'

  const ranked = useMemo(() => {
    if (!layerData?.features) return []
    return layerData.features
      .map(f => ({
        name: f.properties?.name,
        value: f.properties?.[activeMethodId],
        feature: f,
      }))
      .filter(r => r.name && r.value != null)
      .sort((a, b) => sortAsc ? a.value - b.value : b.value - a.value)
  }, [layerData, activeMethodId, sortAsc])

  function handleMouseEnter(row) {
    const lngLat = computeCentroid(row.feature.geometry)
    onHover({ feature: row.feature, lngLat })
  }

  function fmtValue(v) {
    if (isCoverage) return `${v.toFixed(1)}%`
    const prefix = v >= 0 ? '+' : ''
    return `${prefix}${v.toFixed(1)}%`
  }

  return (
    <section className="sidebar-section leaderboard-section">
      <button
        className="leaderboard-toggle"
        onClick={() => setOpen(o => !o)}
      >
        <span className="section-label" style={{ marginBottom: 0 }}>Leaderboard</span>
        <span className={`leaderboard-chevron ${open ? 'open' : ''}`}>&#9662;</span>
      </button>

      {open && (
        <>
          <div className="leaderboard-controls">
            <span className="leaderboard-metric">{method?.label}</span>
            <button
              className="leaderboard-sort-btn"
              onClick={() => setSortAsc(a => !a)}
              title={sortAsc ? 'Showing lowest first' : 'Showing highest first'}
            >
              {sortAsc ? '\u2191 Lowest' : '\u2193 Highest'}
            </button>
          </div>
          <div className="leaderboard-list">
            {ranked.map((row, i) => (
              <div
                key={row.name}
                className="leaderboard-row"
                onMouseEnter={() => handleMouseEnter(row)}
                onMouseLeave={onHoverEnd}
                onClick={() => onFeatureSelect(row.name)}
              >
                <span className="leaderboard-rank">{i + 1}</span>
                <span className="leaderboard-name">{row.name}</span>
                <span className={`leaderboard-value ${
                  isCoverage ? '' : (row.value >= 0 ? 'positive' : 'negative')
                }`}>
                  {fmtValue(row.value)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
