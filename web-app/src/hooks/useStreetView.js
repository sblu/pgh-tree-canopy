/**
 * useStreetView — lazily loads the Google Maps JS SDK, discovers
 * historical + current Street View panoramas for a clicked tree polygon,
 * and returns Static API image URLs for a before/after comparison.
 */
import { useState, useEffect, useRef } from 'react'
import bearing from '@turf/bearing'
import { point } from '@turf/helpers'
import { getStreetViewPosition } from '../utils/streetView'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// ── SDK lazy-loader (singleton) ─────────────────────────────────────────

let sdkPromise = null
let sdkFailed = false

function loadGoogleMapsSDK() {
  if (sdkFailed) return Promise.reject(new Error('SDK previously failed to load'))
  if (sdkPromise) return sdkPromise

  sdkPromise = (async () => {
    // Load the bootstrap script if not already present
    if (!window.google?.maps?.importLibrary) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async`
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => {
          sdkFailed = true
          reject(new Error('Failed to load Google Maps SDK'))
        }
        document.head.appendChild(script)
      })
    }
    // With loading=async, classes must be loaded via importLibrary
    const lib = await window.google.maps.importLibrary('streetView')
    return lib
  })().catch(err => {
    sdkFailed = true
    sdkPromise = null
    throw err
  })
  return sdkPromise
}

// ── Helpers ─────────────────────────────────────────────────────────────

const HISTORICAL_CUTOFF = '2015-03'

/**
 * Extract { pano, date } pairs from the StreetViewPanoramaData.time array.
 * The date property name is minified by Google and varies between API versions,
 * so we search for a YYYY-MM string or Date object among each entry's values.
 */
function parseTimeEntries(timeArray) {
  if (!timeArray?.length) return []
  return timeArray.map(entry => {
    const panoId = entry.pano
    if (!panoId) return null
    let dateStr = null
    for (const val of Object.values(entry)) {
      if (val === panoId) continue
      if (typeof val === 'string' && /^\d{4}-\d{2}$/.test(val)) {
        dateStr = val
        break
      }
      if (val instanceof Date && !isNaN(val)) {
        dateStr = `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}`
        break
      }
    }
    return dateStr ? { pano: panoId, date: dateStr } : null
  }).filter(Boolean)
}

/** "2014-08" → "August 2014" */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown date'
  const [year, month] = dateStr.split('-')
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${names[parseInt(month, 10) - 1] || month} ${year}`
}

function buildStaticUrl(panoId, heading) {
  return (
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=600x400&pano=${panoId}&heading=${heading.toFixed(1)}&pitch=0&key=${API_KEY}`
  )
}

function isPermanentError(err) {
  if (sdkFailed) return true
  const code = err?.code || ''
  const msg = (err?.message || '').toLowerCase()
  return (
    code === 'REQUEST_DENIED' ||
    code === 'OVER_QUERY_LIMIT' ||
    msg.includes('failed to load') ||
    msg.includes('403') ||
    msg.includes('request_denied')
  )
}

// ── Hook ────────────────────────────────────────────────────────────────

export default function useStreetView(clickedTree, streetCenterlines) {
  const [loading, setLoading] = useState(false)
  const [panoData, setPanoData] = useState(null)
  const [disabled, setDisabled] = useState(!API_KEY)
  const requestIdRef = useRef(0)
  const disabledRef = useRef(!API_KEY)

  useEffect(() => {
    // Nothing to do if no polygon clicked, or API is permanently disabled
    if (!clickedTree || disabledRef.current) {
      setPanoData(null)
      setLoading(false)
      return
    }

    const currentRequestId = ++requestIdRef.current
    const p = clickedTree.feature.properties

    // Compute camera position on nearest street
    const pos = getStreetViewPosition(p.centroid_lat, p.centroid_lon, streetCenterlines)
    if (!pos) {
      setPanoData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setPanoData(null)

    ;(async () => {
      try {
        const { StreetViewService, StreetViewSource } = await loadGoogleMapsSDK()
        if (currentRequestId !== requestIdRef.current) return

        const service = new StreetViewService()
        const response = await service.getPanorama({
          location: { lat: pos.lat, lng: pos.lng },
          radius: 50,
          source: StreetViewSource.OUTDOOR,
        })
        if (currentRequestId !== requestIdRef.current) return

        const data = response.data

        // Parse available time periods
        const timeEntries = parseTimeEntries(data.time)
        timeEntries.sort((a, b) => b.date.localeCompare(a.date))

        // Current: most recent panorama
        const currentEntry = timeEntries[0] || {
          pano: data.location.pano,
          date: data.imageDate,
        }

        // Historical: newest panorama from March 2015 or earlier
        const historicalEntry = timeEntries.find(e => e.date <= HISTORICAL_CUTOFF) || null

        // Recalculate heading from actual pano location → centroid
        // (the pano may be offset from our computed camera position)
        const ll = data.location.latLng
        const actualLat = typeof ll.lat === 'function' ? ll.lat() : ll.lat
        const actualLng = typeof ll.lng === 'function' ? ll.lng() : ll.lng
        const centroid = point([p.centroid_lon, p.centroid_lat])
        const panoPoint = point([actualLng, actualLat])
        const headingToCentroid = (bearing(panoPoint, centroid) + 360) % 360

        const streetViewUrl =
          `https://www.google.com/maps/@${actualLat},${actualLng},3a,75y,` +
          `${headingToCentroid.toFixed(1)}h,90t/data=!3m1!1e1`

        setPanoData({
          currentImageUrl: buildStaticUrl(currentEntry.pano, headingToCentroid),
          historicalImageUrl: historicalEntry
            ? buildStaticUrl(historicalEntry.pano, headingToCentroid)
            : null,
          currentDate: formatDate(currentEntry.date),
          historicalDate: historicalEntry ? formatDate(historicalEntry.date) : null,
          streetViewUrl,
        })
      } catch (err) {
        const code = err?.code || ''
        const msg = err?.message || String(err)
        console.warn('[useStreetView]', msg, code ? `(code: ${code})` : '', err)
        if (currentRequestId !== requestIdRef.current) return

        if (isPermanentError(err)) {
          console.warn('[useStreetView] Permanent error — disabling Street View imagery')
          disabledRef.current = true
          setDisabled(true)
        }
        setPanoData(null)
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    })()
  }, [clickedTree, streetCenterlines])

  return { loading, panoData, disabled }
}
