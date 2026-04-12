/**
 * StreetViewModal — full-viewport overlay showing historical/current
 * Street View static imagery for a tree canopy change polygon.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import { QRCodeSVG } from 'qrcode.react'
import { trackEvent } from '../utils/analytics'

export default function StreetViewModal({ panoData, isGain, feature, onClose, onShare }) {
  const [currentImgError, setCurrentImgError] = useState(false)
  const [historicalImgError, setHistoricalImgError] = useState(false)
  const [screenshotting, setScreenshotting] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const captureRef = useRef(null)

  // Track street view open
  useEffect(() => {
    trackEvent('street_view_open', { type: isGain ? 'gain' : 'loss' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  return createPortal(
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
            {/* After (current) — left / top */}
            {panoData.currentImageUrl ? (
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
                  After {isGain ? 'Gain' : 'Loss'} &mdash; {panoData.currentDate}
                </div>
              </div>
            ) : (
              <div className="sv-modal-image-wrapper">
                <div className="sv-modal-img-fallback sv-modal-no-historical">
                  No post-{isGain ? 'gain' : 'loss'} imagery available
                </div>
              </div>
            )}

            {/* Before (historical) — right / bottom */}
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
                  Before {isGain ? 'Gain' : 'Loss'} &mdash; {panoData.historicalDate}
                </div>
              </div>
            ) : (
              <div className="sv-modal-image-wrapper">
                <div className="sv-modal-img-fallback sv-modal-no-historical">
                  No pre-{isGain ? 'gain' : 'loss'} imagery available
                </div>
              </div>
            )}
          </div>

          <div className="sv-modal-qr">
            <QRCodeSVG value={panoData.streetViewUrl} size={64} />
            <span className="sv-modal-qr-label">Scan to open in Google Street View</span>
          </div>
        </div>

        <div className="sv-modal-footer">
          <a
            href={panoData.streetViewUrl}
            target="_blank"
            rel="noreferrer"
            className="sv-modal-link"
            onClick={() => trackEvent('street_view_external', { type: isGain ? 'gain' : 'loss' })}
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
          {onShare && (
            <button
              className="sv-modal-link sv-modal-screenshot-btn"
              onClick={async () => {
                const ok = await onShare()
                if (ok) { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000) }
              }}
            >
              {shareCopied ? 'Link Copied!' : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: 4}}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share This View</>}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
