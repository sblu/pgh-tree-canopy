/**
 * InfoPanel — shown in a MapLibre Popup on hover.
 * Displays canopy statistics for the hovered boundary zone.
 */
import { TREE_LOSS_COLORS } from '../config/layers'

const fmt = {
  // 2 decimals so independently-rounded rows still add up:
  // canopy_2020 − canopy_2015 = net_change_acres at the displayed precision.
  acres: v => (v == null
    ? '—'
    : `${Math.abs(Number(v)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} acres`),
  pct:   v => (v == null ? '—' : `${Number(v).toFixed(1)}%`),
  signedPct: v => {
    if (v == null) return '—'
    const n = Number(v)
    const prefix = n >= 0 ? '+' : ''
    return `${prefix}${n.toFixed(1)}%`
  },
}

export default function InfoPanel({ feature, method, rank, onExemplarClick }) {
  if (!feature) return null
  const p = feature.properties
  const hasExemplar = !!p.exemplar_loss_svg_path

  const canopy2015Pct = p.land_area_acres > 0
    ? (p.canopy_2015_acres / p.land_area_acres * 100).toFixed(1)
    : '—'
  const canopy2020Pct = p.land_area_acres > 0
    ? (p.canopy_2020_acres / p.land_area_acres * 100).toFixed(1)
    : '—'

  const netAcres = p.net_change_acres ?? (p.gain_acres - p.loss_acres)
  const isGain = netAcres >= 0
  const netSign = isGain ? '+' : ''

  return (
    <div className="info-panel">
      <div className="info-panel-name">{p.name}</div>
      {rank && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
          Rank {rank.rank.toLocaleString()} of {rank.total.toLocaleString()}
        </div>
      )}

      <table className="info-table">
        <tbody>
          <tr>
            <td>{p.buffer_area_acres != null ? 'Buffer area' : 'Land area'}</td>
            <td>{fmt.acres(p.land_area_acres)}</td>
          </tr>
          <tr className="section-header">
            <td colSpan={2}>Canopy coverage</td>
          </tr>
          <tr>
            <td>2015</td>
            <td>{fmt.acres(p.canopy_2015_acres)} <span className="muted">({canopy2015Pct}%)</span></td>
          </tr>
          <tr>
            <td>2020</td>
            <td className={method === 'canopy_2020_pct' ? 'highlight' : ''}>
              {fmt.acres(p.canopy_2020_acres)} <span className={method === 'canopy_2020_pct' ? '' : 'muted'}>({canopy2020Pct}%)</span>
            </td>
          </tr>
          <tr className="section-header">
            <td colSpan={2}>Net canopy change</td>
          </tr>
          <tr>
            <td>{isGain ? 'Acres gained' : 'Acres lost'}</td>
            <td className={isGain ? 'positive' : 'negative'}>
              {netSign}{fmt.acres(netAcres)}
            </td>
          </tr>
          <tr>
            <td>% of land area</td>
            <td className={p.net_pct_of_area >= 0 ? 'positive' : 'negative'}>
              {fmt.signedPct(p.net_pct_of_area)}
            </td>
          </tr>
          <tr>
            <td>% of 2015 canopy</td>
            <td className={p.net_pct_of_2015_canopy >= 0 ? 'positive' : 'negative'}>
              {fmt.signedPct(p.net_pct_of_2015_canopy)}
            </td>
          </tr>
          {(p.mature_areas_lost > 0 || p.mature_areas_gained > 0) && (
            <>
              <tr className="section-header">
                <td colSpan={2}>Gains &amp; losses (≥ 0.04 acres)</td>
              </tr>
              <tr>
                <td>Gains</td>
                <td className="positive">{p.mature_areas_gained?.toLocaleString()} <span className="muted">({p.mature_trees_gained?.toLocaleString()} medium, {p.groves_gained?.toLocaleString()} large)</span></td>
              </tr>
              <tr>
                <td>Losses</td>
                <td className="negative">{p.mature_areas_lost?.toLocaleString()} <span className="muted">({p.mature_trees_lost?.toLocaleString()} medium, {p.groves_lost?.toLocaleString()} large)</span></td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {hasExemplar && onExemplarClick && (
        <div className="info-cta">
          <div className="info-cta-text">
            See what was lost, click below for a before/after street view.
          </div>
          <button
            type="button"
            className="info-cta-shape"
            onClick={() => onExemplarClick({
              name: p.name,
              lon: Number(p.exemplar_loss_centroid_lon),
              lat: Number(p.exemplar_loss_centroid_lat),
              acres: Number(p.exemplar_loss_acres),
              sizeCategory: p.exemplar_loss_size_category,
            })}
            aria-label={`Open before/after street view for a ${Number(p.exemplar_loss_acres).toFixed(2)}-acre tree loss in ${p.name}`}
          >
            <div className="info-cta-tile">
              {/* Map-tile-like backdrop */}
              <svg className="info-cta-tile-map" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <rect width="100" height="60" fill="#e8dfd0" />
                {/* Two streets — casing then white inner stroke */}
                <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <g stroke="#cdc4b0" strokeWidth="7">
                    <path d="M -5 18 Q 30 14 60 22 T 110 18" />
                    <path d="M 70 -5 C 60 22 55 40 75 65" />
                  </g>
                  <g stroke="#ffffff" strokeWidth="4">
                    <path d="M -5 18 Q 30 14 60 22 T 110 18" />
                    <path d="M 70 -5 C 60 22 55 40 75 65" />
                  </g>
                </g>
                {/* House silhouettes */}
                <g fill="#c2b59a" stroke="#a89a7e" strokeWidth="0.4">
                  <path d="M 6 38 L 11 33 L 16 38 L 16 47 L 6 47 Z" />
                  <path d="M 86 41 L 90 36 L 94 41 L 94 49 L 86 49 Z" />
                </g>
              </svg>

              {/* Loss shape on top — colors match the actual map polygon */}
              <svg className="info-cta-tile-shape" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <path
                  d={p.exemplar_loss_svg_path}
                  fill={p.exemplar_loss_size_category === 'grove' ? TREE_LOSS_COLORS.grove : TREE_LOSS_COLORS.tree}
                  fillOpacity="0.85"
                  stroke="#5b0909"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="info-cta-shape-meta">
              {p.exemplar_loss_nearest_street
                ? `Example loss on ${p.exemplar_loss_nearest_street} (${Number(p.exemplar_loss_acres).toFixed(2)} acres)`
                : `Example tree loss (${Number(p.exemplar_loss_acres).toFixed(2)} acres)`}
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
