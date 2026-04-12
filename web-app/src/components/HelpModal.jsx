import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CTA_LINKS } from '../config/layers'
import { trackEvent } from '../utils/analytics'

const STORAGE_KEY = 'hideHelpOnStartup'

export default function HelpModal({ onClose }) {
  const [showAtStartup, setShowAtStartup] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== '1'
  )

  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleStartupChange(e) {
    const checked = e.target.checked
    setShowAtStartup(checked)
    if (checked) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, '1')
    }
  }

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-modal" onClick={e => e.stopPropagation()}>

        <div className="help-header">
          <h2 className="help-title">Pittsburgh Tree Canopy</h2>
          <button className="help-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="help-body">
          <p className="help-intro">
            This map shows <strong>tree canopy change across Pittsburgh from 2015 to 2020</strong> —
            where canopy was gained, where it was lost, and by how much.
            Data is from <a href="https://www.treepittsburgh.org" target="_blank" rel="noopener noreferrer">Tree Pittsburgh</a>,
            analyzed by neighborhood, district, park, and street.
          </p>

          <div className="help-section-heading">Exploring the Map</div>
          <ul className="help-list">
            <li><strong>Click any shaded zone</strong> to see its canopy stats in the sidebar.</li>
            <li><strong>View By</strong> switches between neighborhoods, city council districts, county districts, parks, municipalities, and streets.</li>
            <li><strong>Color By</strong> changes the metric — compare 2020 coverage, net change as a share of land area, or net change relative to 2015 canopy.</li>
            <li><strong>Losses / Gains overlays</strong> show individual tree polygons on the map. Zoom in to explore them.</li>
          </ul>

          <div className="help-section-heading">Google Street View</div>
          <ul className="help-list">
            <li>Zoom into the map and <strong>click a red or green polygon</strong> (individual tree loss or gain) to open a before-and-after Street View.</li>
            <li>Street View shows the location from the nearest street, in both the current view and historical imagery.</li>
          </ul>

          <div className="help-section-heading">How to Help</div>
          <div className="help-ctas">
            {Object.values(CTA_LINKS).map(cta => (
              <a key={cta.label} href={cta.url} target="_blank" rel="noopener noreferrer" className="cta-link" onClick={() => trackEvent('cta_click', { link: cta.label })}>
                <span className="cta-emoji">{cta.emoji}</span>
                <span className="cta-text">
                  <span className="cta-label">{cta.label}</span>
                  <span className="cta-desc">{cta.description}</span>
                </span>
              </a>
            ))}
          </div>

          <div className="help-footer">
            <label className="help-startup-check">
              <input
                type="checkbox"
                checked={showAtStartup}
                onChange={handleStartupChange}
              />
              Show at startup
            </label>
            <div className="legend-attribution">
              Canopy data: <a href="https://www.treepittsburgh.org" target="_blank" rel="noopener noreferrer">Tree Pittsburgh</a>
              &nbsp;·&nbsp;
              Visualization: <a href="https://github.com/sblu/pgh-tree-canopy" target="_blank" rel="noopener noreferrer">GitHub</a>
              <br/>
              Build: {__BUILD_TAG__}
            </div>
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}
