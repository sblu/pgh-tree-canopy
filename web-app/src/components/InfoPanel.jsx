/**
 * InfoPanel — shown in a MapLibre Popup on hover.
 * Displays canopy statistics for the hovered boundary zone.
 */

const fmt = {
  acres: v => (v == null ? '—' : `${Math.abs(Number(v)).toLocaleString(undefined, { maximumFractionDigits: 1 })} acres`),
  pct:   v => (v == null ? '—' : `${Number(v).toFixed(1)}%`),
  signedPct: v => {
    if (v == null) return '—'
    const n = Number(v)
    const prefix = n >= 0 ? '+' : ''
    return `${prefix}${n.toFixed(1)}%`
  },
}

export default function InfoPanel({ feature, method }) {
  if (!feature) return null
  const p = feature.properties

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
                <td className="negative">{p.mature_areas_lost?.toLocaleString()} <span className="muted">({p.mature_trees_lost?.toLocaleString()} trees, {p.groves_lost?.toLocaleString()} groves)</span></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
