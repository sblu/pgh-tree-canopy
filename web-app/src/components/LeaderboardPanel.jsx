import { useMemo, useState } from 'react'
import { COLOR_METHODS, CTA_LINKS } from '../config/layers'

function computeCentroid(geometry) {
  let sumLng = 0, sumLat = 0, count = 0
  const walk = coords => {
    if (typeof coords[0] === 'number') { sumLng += coords[0]; sumLat += coords[1]; count++ }
    else coords.forEach(walk)
  }
  walk(geometry.coordinates)
  return count > 0 ? { lng: sumLng / count, lat: sumLat / count } : { lng: 0, lat: 0 }
}

function fmtAcres(v) {
  if (v == null) return '—'
  return Math.abs(Number(v)).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function fmtPct(v, isCoverage) {
  if (v == null) return '—'
  const n = Number(v)
  if (isCoverage) return `${n.toFixed(1)}%`
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

export default function LeaderboardPanel({
  isOpen,           // boolean — controlled by left-rail icon in App.jsx
  inline = false,   // true when rendered inside MobileSheet
  layerData,        // GeoJSON FeatureCollection | null
  activeMethodId,   // string
  selectedFeatureName, // string | null
  onFeatureSelect,  // (name: string | null) => void
  onHover,          // ({ feature, lngLat }) => void
  onHoverEnd,       // () => void
}) {
  const [sortAsc, setSortAsc]     = useState(false)
  const [showAll, setShowAll]     = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)

  const method    = COLOR_METHODS.find(m => m.id === activeMethodId)
  const isCoverage = method?.group === 'coverage'

  const MAX_ROWS = 1000

  const ranked = useMemo(() => {
    if (!layerData?.features) return []
    setShowAll(false)
    setLoadingAll(false)
    return layerData.features
      .map(f => ({ name: f.properties?.name, value: f.properties?.[activeMethodId], feature: f }))
      .filter(r => r.name && r.value != null)
      .sort((a, b) => sortAsc ? a.value - b.value : b.value - a.value)
  }, [layerData, activeMethodId, sortAsc])

  const totalCount = ranked.length
  const isCapped = !showAll && totalCount > MAX_ROWS
  const displayedRanked = isCapped ? ranked.slice(0, MAX_ROWS) : ranked

  const maxAbs = useMemo(() => Math.max(...ranked.map(r => Math.abs(r.value)), 0.001), [ranked])

  const selectedFeature = useMemo(() => {
    if (!selectedFeatureName || !layerData?.features) return null
    return layerData.features.find(f => f.properties?.name === selectedFeatureName) ?? null
  }, [selectedFeatureName, layerData])

  const selectedRank = useMemo(() => {
    if (!selectedFeatureName) return null
    const idx = ranked.findIndex(r => r.name === selectedFeatureName)
    return idx >= 0 ? idx + 1 : null
  }, [ranked, selectedFeatureName])

  function handleRowEnter(row) {
    const lngLat = computeCentroid(row.feature.geometry)
    onHover({ feature: row.feature, lngLat })
  }

  const p = selectedFeature?.properties
  const netVal = p ? (p[activeMethodId] ?? null) : null
  const isLoss = netVal != null && !isCoverage && netVal < 0

  return (
    <div className={`leaderboard-panel${inline ? ' leaderboard-panel--inline' : (isOpen ? '' : ' leaderboard-panel--closed')}`}>
      <div className="lb-inner">
        <div className="lb-panel-title">
          {method?.label ?? 'Leaderboard'}
          <button className="lb-sort-btn" onClick={() => setSortAsc(a => !a)}>
            {sortAsc ? '↑ Lowest' : '↓ Highest'}
          </button>
        </div>

        {/* Selected boundary card */}
        {selectedFeature && p && (
          <div className="lb-selected-card">
            <div className="lb-selected-name">
              {p.name}
              <button className="lb-dismiss-btn" onClick={() => onFeatureSelect(null)}>✕</button>
            </div>
            <div className="lb-selected-sub">
              {p.land_area_acres != null ? `${p.land_area_acres.toFixed(0)} acres` : ''}
              {selectedRank && (
                <span style={{ marginLeft: p.land_area_acres != null ? '8px' : 0, color: 'var(--muted)' }}>
                  · Rank {selectedRank.toLocaleString()} of {totalCount.toLocaleString()}
                  {sortAsc ? ' (lowest first)' : ''}
                </span>
              )}
            </div>
            <div className="lb-stat-grid">
              <div className="lb-stat">
                <div className={`lb-stat-val ${isLoss ? 'lb-stat-val--amber' : isCoverage ? 'lb-stat-val--neutral' : 'lb-stat-val--green'}`}>
                  {fmtPct(netVal, isCoverage)}
                </div>
                <div className="lb-stat-lbl">
                  {isCoverage ? '2020 Canopy' : 'Net Change'}
                </div>
              </div>
              <div className="lb-stat">
                <div className="lb-stat-val lb-stat-val--neutral">
                  {p.canopy_2020_acres != null && p.land_area_acres > 0
                    ? `${(p.canopy_2020_acres / p.land_area_acres * 100).toFixed(1)}%`
                    : '—'}
                </div>
                <div className="lb-stat-lbl">2020 Coverage</div>
              </div>
              <div className="lb-stat">
                <div className="lb-stat-val lb-stat-val--green">{fmtAcres(p.gain_acres)}</div>
                <div className="lb-stat-lbl">Acres Gained</div>
              </div>
              <div className="lb-stat">
                <div className="lb-stat-val lb-stat-val--amber">{fmtAcres(p.loss_acres)}</div>
                <div className="lb-stat-lbl">Acres Lost</div>
              </div>
            </div>
          </div>
        )}

        {/* Ranked list */}
        {ranked.length === 0 && (
          <div className="lb-empty">Click a zone on the map<br/>to explore its canopy data</div>
        )}
        {ranked.length > 0 && (
          <>
            {displayedRanked.map((row, i) => {
              const barPct = (Math.abs(row.value) / maxAbs) * 100
              const isNeg  = !isCoverage && row.value < 0
              const isSel  = row.name === selectedFeatureName
              return (
                <div
                  key={row.name}
                  className={`lb-list-row${isSel ? ' lb-list-row--selected' : ''}`}
                  onMouseEnter={() => handleRowEnter(row)}
                  onMouseLeave={onHoverEnd}
                  onClick={() => onFeatureSelect(row.name)}
                >
                  <span className="lb-rank">{i + 1}</span>
                  <span className={`lb-name${isSel ? ' lb-name--selected' : ''}`}>{row.name}</span>
                  <div className="lb-bar-wrap">
                    <div className="lb-bar-bg">
                      <div className={`lb-bar${isNeg ? ' lb-bar--loss' : ''}`} style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <span className={`lb-val${isNeg ? ' lb-val--loss' : ''}`}>
                    {fmtPct(row.value, isCoverage)}
                  </span>
                </div>
              )
            })}
            {isCapped && (
              <div style={{ fontSize: '10px', color: 'var(--inactive)', padding: '8px 0 4px', textAlign: 'center' }}>
                Showing {MAX_ROWS.toLocaleString()} of {totalCount.toLocaleString()} —{' '}
                {loadingAll ? (
                  <span style={{ color: 'var(--muted)' }}>loading…</span>
                ) : (
                  <button
                    onClick={() => { setLoadingAll(true); setTimeout(() => setShowAll(true), 0) }}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    load all
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Calls to action */}
        <div className="cta-section">
          <div className="cta-heading">How to Help</div>
          {Object.values(CTA_LINKS).map(cta => (
            <a key={cta.label} href={cta.url} target="_blank" rel="noopener noreferrer" className="cta-link">
              <span className="cta-emoji">{cta.emoji}</span>
              <span className="cta-text">
                <span className="cta-label">{cta.label}</span>
                <span className="cta-desc">{cta.description}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
