/**
 * InfoPanel — shown in a MapLibre Popup on hover.
 * Displays canopy statistics for the hovered boundary zone.
 */

const fmt = {
  acres: v => (v == null ? '—' : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} ac`),
  pct:   v => (v == null ? '—' : `${Number(v).toFixed(1)}%`),
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
  const netChange = p.canopy_2020_acres - p.canopy_2015_acres
  const netSign = netChange >= 0 ? '+' : ''

  return (
    <div className="info-panel">
      <div className="info-panel-name">{p.name}</div>

      <table className="info-table">
        <tbody>
          <tr>
            <td>Land area</td>
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
            <td>{fmt.acres(p.canopy_2020_acres)} <span className="muted">({canopy2020Pct}%)</span></td>
          </tr>
          <tr>
            <td>Net change</td>
            <td className={netChange >= 0 ? 'positive' : 'negative'}>
              {netSign}{fmt.acres(netChange)}
            </td>
          </tr>
          <tr className="section-header">
            <td colSpan={2}>Canopy loss</td>
          </tr>
          <tr>
            <td>Acres lost</td>
            <td>{fmt.acres(p.loss_acres)}</td>
          </tr>
          <tr>
            <td>% of land area</td>
            <td className={method === 'loss_pct_of_area' ? 'highlight' : ''}>
              {fmt.pct(p.loss_pct_of_area)}
            </td>
          </tr>
          <tr>
            <td>% of 2015 canopy</td>
            <td className={method === 'loss_pct_of_2015_canopy' ? 'highlight' : ''}>
              {fmt.pct(p.loss_pct_of_2015_canopy)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
