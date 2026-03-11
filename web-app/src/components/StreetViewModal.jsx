/**
 * StreetViewModal — full-viewport overlay showing historical/current
 * Street View static imagery for a tree canopy change polygon.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'

export default function StreetViewModal({ panoData, isGain, feature, onClose }) {
  const [currentImgError, setCurrentImgError] = useState(false)
  const [historicalImgError, setHistoricalImgError] = useState(false)
  const [screenshotting, setScreenshotting] = useState(false)
  const captureRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleScreenshot = useCallback(async () => {
    if (!captureRef.current || screenshotting) return
    setScreenshotting(true)
    try {
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = 'street-view-comparison.png'
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.warn('[StreetViewModal] Screenshot failed:', err)
    } finally {
      setScreenshotting(false)
    }
  }, [screenshotting])

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
        {/* Capture region: header + address + images (not footer buttons) */}
        <div ref={captureRef}>
          <div className="sv-modal-header">
            <span className={`sv-modal-title ${isGain ? 'gain' : 'loss'}`}>
              {headerText}
            </span>
            <button className="sv-modal-close sv-modal-hide-capture" onClick={onClose}>&times;</button>
          </div>

          {panoData.address && (
            <div className="sv-modal-address">{panoData.address}</div>
          )}

          <div className="sv-modal-images">
            {/* Today (current) — left / top */}
            <div className="sv-modal-image-wrapper">
              {currentImgError ? (
                <div className="sv-modal-img-fallback">Image unavailable</div>
              ) : (
                <img
                  src={panoData.currentImageUrl}
                  alt={`Street view from ${panoData.currentDate}`}
                  className="sv-modal-img"
                  crossOrigin="anonymous"
                  onError={() => setCurrentImgError(true)}
                />
              )}
              <div className="sv-modal-date">
                Today &mdash; {panoData.currentDate}
              </div>
            </div>

            {/* Historical — right / bottom */}
            {panoData.historicalImageUrl ? (
              <div className="sv-modal-image-wrapper">
                {historicalImgError ? (
                  <div className="sv-modal-img-fallback">Image unavailable</div>
                ) : (
                  <img
                    src={panoData.historicalImageUrl}
                    alt={`Street view from ${panoData.historicalDate}`}
                    className="sv-modal-img"
                    crossOrigin="anonymous"
                    onError={() => setHistoricalImgError(true)}
                  />
                )}
                <div className="sv-modal-date">
                  Historical &mdash; {panoData.historicalDate}
                </div>
              </div>
            ) : (
              <div className="sv-modal-image-wrapper">
                <div className="sv-modal-img-fallback sv-modal-no-historical">
                  No 2015 or earlier imagery available
                </div>
              </div>
            )}
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
          <button
            className="sv-modal-link sv-modal-screenshot-btn"
            onClick={handleScreenshot}
            disabled={screenshotting}
          >
            {screenshotting ? 'Saving...' : 'Save Screenshot'}
          </button>
        </div>
      </div>
    </div>
  )
}
