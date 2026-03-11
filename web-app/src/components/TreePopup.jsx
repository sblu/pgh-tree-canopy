/**
 * TreePopup — shown when a user hovers or clicks on a loss/gain polygon.
 * Displays size info and a Google Street View link to see the location.
 * In hoverMode, shows data with a "click for Street View" hint.
 */
import { useMemo } from 'react'
import { getStreetViewUrl } from '../utils/streetView'

export default function TreePopup({ feature, isGain, streetCenterlines, hoverMode, streetViewLoading, streetViewDisabled }) {
  const p = feature?.properties

  // Compute Street View URL: position on nearest street, aimed at polygon centroid
  const streetViewUrl = useMemo(
    () => p ? getStreetViewUrl(p.centroid_lat, p.centroid_lon, streetCenterlines) : null,
    [p, streetCenterlines]
  )

  if (!feature) return null

  const sizeCategory = isGain
    ? (p.size_category === 'grove' ? 'Large gain' : 'Medium gain')
    : (p.size_category === 'grove' ? 'Grove' : 'Single tree')
  const rawAcres = isGain ? p.gain_acres : p.loss_acres
  const acres = rawAcres != null
    ? Number(rawAcres).toFixed(3)
    : null

  return (
    <div className="tree-popup">
      <div className={`tree-popup-header ${isGain ? 'gain' : 'loss'}`}>
        {isGain ? 'Canopy Gain' : 'Canopy Loss'}
      </div>
      <div className="tree-popup-body">
        <div className="tree-popup-row">
          <span className="tree-popup-label">Type</span>
          <span>{sizeCategory}</span>
        </div>
        {acres != null && (
          <div className="tree-popup-row">
            <span className="tree-popup-label">Area</span>
            <span>{acres} acres</span>
          </div>
        )}
        {hoverMode ? (
          <div className="tree-popup-hint">
            Click for Google Street View
          </div>
        ) : (streetViewLoading && !streetViewDisabled) ? (
          <div className="tree-popup-hint">
            Loading Street View...
          </div>
        ) : streetViewUrl ? (
          <a
            className="tree-popup-streetview"
            href={streetViewUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Street View
          </a>
        ) : (
          <div className="tree-popup-no-coords">
            Coordinates not available
          </div>
        )}
      </div>
    </div>
  )
}
