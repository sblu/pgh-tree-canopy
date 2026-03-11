/**
 * StreetViewModal — full-viewport overlay showing before/after
 * Street View static imagery for a tree canopy change polygon.
 */
import { useState, useEffect } from 'react'

export default function StreetViewModal({ panoData, isGain, feature, onClose }) {
  const [currentImgError, setCurrentImgError] = useState(false)
  const [historicalImgError, setHistoricalImgError] = useState(false)

  // Reset image error state when panoData changes (new polygon)
  useEffect(() => {
    setCurrentImgError(false)
    setHistoricalImgError(false)
  }, [panoData])

  // Close on Escape key
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!panoData) return null

  const p = feature?.properties
  const sizeCategory = isGain
    ? (p?.size_category === 'grove' ? 'Large gain' : 'Medium gain')
    : (p?.size_category === 'grove' ? 'Grove' : 'Single tree')
  const rawAcres = isGain ? p?.gain_acres : p?.loss_acres
  const acres = rawAcres != null ? Number(rawAcres).toFixed(3) : null
  const typeLabel = isGain ? 'Canopy Gain' : 'Canopy Loss'
  const headerText = acres
    ? `${typeLabel} \u2014 ${sizeCategory} (${acres} acres)`
    : `${typeLabel} \u2014 ${sizeCategory}`

  return (
    <div className="sv-modal-backdrop" onClick={onClose}>
      <div className="sv-modal" onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <span className={`sv-modal-title ${isGain ? 'gain' : 'loss'}`}>
            {headerText}
          </span>
          <button className="sv-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="sv-modal-images">
          {/* Before (historical) */}
          {panoData.historicalImageUrl ? (
            <div className="sv-modal-image-wrapper">
              {historicalImgError ? (
                <div className="sv-modal-img-fallback">Image unavailable</div>
              ) : (
                <img
                  src={panoData.historicalImageUrl}
                  alt={`Street view from ${panoData.historicalDate}`}
                  className="sv-modal-img"
                  onError={() => setHistoricalImgError(true)}
                />
              )}
              <div className="sv-modal-date">
                Before &mdash; {panoData.historicalDate}
              </div>
            </div>
          ) : (
            <div className="sv-modal-image-wrapper">
              <div className="sv-modal-img-fallback sv-modal-no-historical">
                No 2015 or earlier imagery available
              </div>
            </div>
          )}

          {/* After (current) */}
          <div className="sv-modal-image-wrapper">
            {currentImgError ? (
              <div className="sv-modal-img-fallback">Image unavailable</div>
            ) : (
              <img
                src={panoData.currentImageUrl}
                alt={`Street view from ${panoData.currentDate}`}
                className="sv-modal-img"
                onError={() => setCurrentImgError(true)}
              />
            )}
            <div className="sv-modal-date">
              After &mdash; {panoData.currentDate}
            </div>
          </div>
        </div>

        <div className="sv-modal-footer">
          <a
            href={panoData.streetViewUrl}
            target="_blank"
            rel="noreferrer"
            className="sv-modal-link"
          >
            Open in Google Street View
          </a>
        </div>
      </div>
    </div>
  )
}
