# Street View Before/After Imagery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed historical and current Street View static imagery in a before/after comparison modal when users click tree loss/gain polygons.

**Architecture:** Google Maps JS SDK loaded lazily on first click. `StreetViewService` (free) discovers panorama IDs + dates. Street View Static API renders images via `<img>` tags. Fallback to current link-only behavior when API key is missing or fails.

**Tech Stack:** React 19, Vite (env vars), Google Maps JavaScript API, Street View Static API, turf.js (bearing)

**Spec:** `docs/superpowers/specs/2026-03-10-street-view-imagery-design.md`

---

## Chunk 1: Foundation

### Task 1: Environment setup

**Files:**
- Create: `web-app/.env.example`
- Modify: `web-app/.gitignore`

- [ ] **Step 1: Create `.env.example`**

```
VITE_GOOGLE_MAPS_API_KEY=your-api-key-here
```

- [ ] **Step 2: Add `.env` to `web-app/.gitignore`**

After the `*.local` line (line 12), add:

```
# Google Maps API key (local only)
.env
```

Note: Vite already reads `.env` from the project root (`web-app/`). The `*.local` pattern covers `.env.local` but NOT `.env` itself, so this explicit entry is needed.

- [ ] **Step 3: Create your real `.env` file**

```bash
echo "VITE_GOOGLE_MAPS_API_KEY=YOUR_REAL_KEY_HERE" > web-app/.env
```

Replace `YOUR_REAL_KEY_HERE` with your actual Google Maps API key.

- [ ] **Step 4: Verify `.env` is gitignored**

```bash
cd web-app && git status
```

Expected: `.env` should NOT appear in untracked files. `.env.example` should appear.

- [ ] **Step 5: Commit**

```bash
git add web-app/.env.example web-app/.gitignore
git commit -m "Add .env.example and gitignore .env for Google Maps API key"
```

---

### Task 2: Refactor `streetView.js` to export camera position

**Files:**
- Modify: `web-app/src/utils/streetView.js`

The existing `getStreetViewUrl()` computes camera position + heading, then formats it into a URL string. We need the raw `{ lat, lng, heading }` values for the hook. Extract a `getStreetViewPosition()` function; refactor `getStreetViewUrl()` to call it.

- [ ] **Step 1: Extract `getStreetViewPosition()` and refactor `getStreetViewUrl()`**

Replace the entire `getStreetViewUrl` export (lines 37-113) with:

```javascript
/**
 * Given a polygon centroid and a GeoJSON FeatureCollection of street
 * centerlines, find the nearest point on the nearest street, back up
 * ~50 ft along the street for a better perspective, and compute the
 * bearing toward the centroid.
 *
 * Returns { lat, lng, heading } or null if inputs are missing / no street nearby.
 */
export function getStreetViewPosition(centroidLat, centroidLon, streetCenterlines) {
  if (centroidLat == null || centroidLon == null || !streetCenterlines?.features?.length) {
    return null
  }

  const centroid = point([centroidLon, centroidLat])

  // Bbox filter: only consider streets within ~0.003 degrees (~300 m)
  const BUFFER = 0.003
  const minLng = centroidLon - BUFFER
  const maxLng = centroidLon + BUFFER
  const minLat = centroidLat - BUFFER
  const maxLat = centroidLat + BUFFER

  let bestPoint = null
  let bestDist = Infinity
  let bestLine = null  // always a LineString (not Multi)

  for (const feature of streetCenterlines.features) {
    const geom = feature.geometry
    if (!geom) continue

    // Quick bbox reject using raw coordinates
    const coordSets = geom.type === 'LineString'
      ? [geom.coordinates]
      : geom.type === 'MultiLineString'
        ? geom.coordinates
        : null
    if (!coordSets) continue

    let inRange = false
    for (const ring of coordSets) {
      for (const [lng, lat] of ring) {
        if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
          inRange = true
          break
        }
      }
      if (inRange) break
    }
    if (!inRange) continue

    // Test each individual LineString so `along` works later
    for (const line of toLineStrings(feature)) {
      const snapped = nearestPointOnLine(line, centroid)
      const dist = snapped.properties.dist
      if (dist < bestDist) {
        bestDist = dist
        bestPoint = snapped
        bestLine = line
      }
    }
  }

  if (!bestPoint || !bestLine) return null

  // Back up ~50 ft along the street for a better viewing angle.
  const loc = bestPoint.properties.location // km along line
  const candidateA = along(bestLine, Math.max(0, loc - OFFSET_KM))
  const candidateB = along(bestLine, loc + OFFSET_KM)

  const distA = distance(candidateA, centroid)
  const distB = distance(candidateB, centroid)

  // Pick whichever candidate is further from the centroid (backs away)
  const camera = distA >= distB ? candidateA : candidateB

  const [streetLng, streetLat] = camera.geometry.coordinates

  // Bearing from the offset street point toward the polygon centroid
  const heading = (bearing(camera, centroid) + 360) % 360

  return { lat: streetLat, lng: streetLng, heading }
}

/**
 * Convenience wrapper: returns a Google Street View URL string, or null.
 * Public API is unchanged from the original.
 */
export function getStreetViewUrl(centroidLat, centroidLon, streetCenterlines) {
  const pos = getStreetViewPosition(centroidLat, centroidLon, streetCenterlines)
  if (!pos) return null
  return `https://www.google.com/maps/@${pos.lat},${pos.lng},3a,75y,${pos.heading.toFixed(1)}h,90t/data=!3m1!1e1`
}
```

- [ ] **Step 2: Verify existing behavior is preserved**

```bash
cd web-app && npm run dev
```

Open the app, hover and click a tree polygon. The "Open in Google Street View" link in the popup should still work identically to before. Click it and verify it opens Google Street View aimed at the tree location.

- [ ] **Step 3: Commit**

```bash
git add web-app/src/utils/streetView.js
git commit -m "Refactor streetView.js: extract getStreetViewPosition for hook reuse"
```

---

## Chunk 2: Hook and Modal

### Task 3: Create `useStreetView` hook

**Files:**
- Create: `web-app/src/hooks/useStreetView.js`

This hook lazy-loads the Google Maps JS SDK, calls `StreetViewService.getPanorama()`, parses historical/current pano IDs from the time array, and constructs Static API image URLs.

- [ ] **Step 1: Create the hook file**

Create `web-app/src/hooks/useStreetView.js`:

```javascript
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
  if (window.google?.maps?.StreetViewService) return Promise.resolve()

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      sdkFailed = true
      reject(new Error('Failed to load Google Maps SDK'))
    }
    document.head.appendChild(script)
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
        await loadGoogleMapsSDK()
        if (currentRequestId !== requestIdRef.current) return

        const service = new google.maps.StreetViewService()
        const response = await service.getPanorama({
          location: { lat: pos.lat, lng: pos.lng },
          radius: 50,
          source: google.maps.StreetViewSource.OUTDOOR,
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
        console.warn('[useStreetView]', err?.message || err)
        if (currentRequestId !== requestIdRef.current) return

        if (isPermanentError(err)) {
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
```

- [ ] **Step 2: Verify it lints**

```bash
cd web-app && npx eslint src/hooks/useStreetView.js
```

Expected: no errors. Warnings about `google` global are OK (it's injected by the SDK script tag).

- [ ] **Step 3: Commit**

```bash
git add web-app/src/hooks/useStreetView.js
git commit -m "Add useStreetView hook: lazy SDK loading, pano discovery, Static API URLs"
```

---

### Task 4: Create `StreetViewModal` component

**Files:**
- Create: `web-app/src/components/StreetViewModal.jsx`

Responsive before/after modal with image error handling, backdrop close, Escape key close.

- [ ] **Step 1: Create the modal component**

Create `web-app/src/components/StreetViewModal.jsx`:

```jsx
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
```

- [ ] **Step 2: Lint**

```bash
cd web-app && npx eslint src/components/StreetViewModal.jsx
```

- [ ] **Step 3: Commit**

```bash
git add web-app/src/components/StreetViewModal.jsx
git commit -m "Add StreetViewModal: responsive before/after comparison popup"
```

---

### Task 5: Add modal CSS

**Files:**
- Modify: `web-app/src/index.css`

Append the Street View modal styles after the existing MapLibre control overrides section (end of file, after line 650).

- [ ] **Step 1: Append modal CSS to `index.css`**

Add at the end of `web-app/src/index.css`:

```css
/* ─── Street View Modal ────────────────────────────────────────────────── */
.sv-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.sv-modal {
  background: #fff;
  border-radius: 10px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
}

.sv-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.sv-modal-title {
  font-weight: 700;
  font-size: 14px;
}

.sv-modal-title.loss { color: #dc2626; }
.sv-modal-title.gain { color: #16a34a; }

.sv-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.sv-modal-close:hover { color: #1e293b; }

.sv-modal-images {
  display: flex;
  gap: 12px;
  padding: 16px;
  flex-wrap: wrap;
}

.sv-modal-image-wrapper {
  flex: 1;
  min-width: 200px;
}

.sv-modal-img {
  width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
}

.sv-modal-img-fallback {
  width: 100%;
  aspect-ratio: 3 / 2;
  background: #f1f5f9;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 13px;
}

.sv-modal-no-historical {
  border: 2px dashed #cbd5e1;
}

.sv-modal-date {
  text-align: center;
  font-size: 12px;
  color: #475569;
  margin-top: 6px;
  font-weight: 500;
}

.sv-modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
  text-align: center;
}

.sv-modal-link {
  display: inline-block;
  padding: 8px 20px;
  background: #1e40af;
  color: #fff;
  border-radius: 5px;
  text-decoration: none;
  font-weight: 600;
  font-size: 12px;
}

.sv-modal-link:hover {
  background: #1d4ed8;
}
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/index.css
git commit -m "Add Street View modal CSS: backdrop, responsive image layout, fallbacks"
```

---

## Chunk 3: Integration

### Task 6: Modify `TreePopup` to show loading state

**Files:**
- Modify: `web-app/src/components/TreePopup.jsx`

Add `streetViewLoading` and `streetViewDisabled` props. When loading (and not disabled), show "Loading Street View..." instead of the link. When disabled (permanent failure), skip loading state and show the link immediately. TreePopup keeps its existing `getStreetViewUrl` call for the fallback link.

- [ ] **Step 1: Update TreePopup**

Replace the entire file `web-app/src/components/TreePopup.jsx`:

```jsx
/**
 * TreePopup — shown when a user hovers or clicks on a loss/gain polygon.
 * Displays size info and a Google Street View link to see the location.
 * In hoverMode, shows data with a "click for Street View" hint.
 * When streetViewLoading is true, shows a loading message instead of the link.
 */
import { useMemo } from 'react'
import { getStreetViewUrl } from '../utils/streetView'

export default function TreePopup({ feature, isGain, streetCenterlines, hoverMode, streetViewLoading, streetViewDisabled }) {
  if (!feature) return null
  const p = feature.properties

  const sizeCategory = isGain
    ? (p.size_category === 'grove' ? 'Large gain' : 'Medium gain')
    : (p.size_category === 'grove' ? 'Grove' : 'Single tree')
  const rawAcres = isGain ? p.gain_acres : p.loss_acres
  const acres = rawAcres != null
    ? Number(rawAcres).toFixed(3)
    : null

  // Compute Street View URL for the fallback link (always available)
  const streetViewUrl = useMemo(
    () => getStreetViewUrl(p.centroid_lat, p.centroid_lon, streetCenterlines),
    [p.centroid_lat, p.centroid_lon, streetCenterlines]
  )

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
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/components/TreePopup.jsx
git commit -m "Add streetViewLoading prop to TreePopup for loading state"
```

---

### Task 7: Integrate hook and modal into MapView

**Files:**
- Modify: `web-app/src/components/MapView.jsx`

Wire up `useStreetView`, manage modal state, dismiss popup when modal opens, render `StreetViewModal`.

- [ ] **Step 1: Add imports**

At the top of `MapView.jsx`, after the existing `import TreePopup from './TreePopup'` line (line 7), add:

```javascript
import StreetViewModal from './StreetViewModal'
import useStreetView from '../hooks/useStreetView'
```

- [ ] **Step 2: Add hook call and modal state**

Inside the `MapView` function, after the `const [clickedTree, setClickedTree] = useState(null)` line (line 69), add:

```javascript
  const [streetViewModalData, setStreetViewModalData] = useState(null)
  const { loading: svLoading, panoData: svPanoData, disabled: svDisabled } = useStreetView(clickedTree, streetCenterlines)

  // Keep a ref to clickedTree so the effect below can read it without
  // adding it as a dependency (which would cause a re-trigger loop when
  // we set clickedTree to null inside the same effect).
  const clickedTreeRef = useRef(null)
  clickedTreeRef.current = clickedTree

  // Auto-open modal when pano data arrives; dismiss the map popup
  useEffect(() => {
    if (svPanoData) {
      setStreetViewModalData({
        panoData: svPanoData,
        feature: clickedTreeRef.current?.feature,
        isGain: clickedTreeRef.current?.isGain,
      })
      setClickedTree(null) // dismiss the MapLibre popup
    }
  }, [svPanoData])
```

- [ ] **Step 3: Pass `streetViewLoading` to TreePopup in the click popup**

In the click popup section (around line 571-577), update the TreePopup usage to pass the loading prop:

Replace:
```jsx
          <TreePopup
            feature={clickedTree.feature}
            isGain={clickedTree.isGain}
            streetCenterlines={streetCenterlines}
          />
```

With:
```jsx
          <TreePopup
            feature={clickedTree.feature}
            isGain={clickedTree.isGain}
            streetCenterlines={streetCenterlines}
            streetViewLoading={svLoading}
            streetViewDisabled={svDisabled}
          />
```

- [ ] **Step 4: Render StreetViewModal outside the Map component**

The modal must render outside the `<Map>` component to avoid z-index issues. Wrap the return in a fragment and add the modal after `</Map>`:

Replace the `return (` section — wrap `<Map ...>...</Map>` in a fragment and add the modal:

```jsx
  return (
    <>
      <Map
        ref={mapRef}
        {/* ... all existing Map props and children stay exactly the same ... */}
      </Map>

      {streetViewModalData && (
        <StreetViewModal
          panoData={streetViewModalData.panoData}
          isGain={streetViewModalData.isGain}
          feature={streetViewModalData.feature}
          onClose={() => setStreetViewModalData(null)}
        />
      )}
    </>
  )
```

- [ ] **Step 5: Lint**

```bash
cd web-app && npx eslint src/components/MapView.jsx
```

- [ ] **Step 6: Commit**

```bash
git add web-app/src/components/MapView.jsx
git commit -m "Integrate useStreetView hook and StreetViewModal into MapView"
```

---

## Chunk 4: Verification

### Task 8: Manual end-to-end verification

- [ ] **Step 1: Start dev server**

```bash
cd web-app && npm run dev
```

- [ ] **Step 2: Test with valid API key**

Open the app. Zoom to level 12+ so tree loss polygons appear. Click a loss polygon.

Verify:
- TreePopup appears with "Loading Street View..." text
- After 1-2 seconds, a modal overlay opens with before/after images
- The MapLibre popup disappears when the modal opens
- "Before" image shows historical Street View (date label should be 2015 or earlier)
- "After" image shows current Street View (recent date)
- "Open in Google Street View" button at the bottom opens Google Maps
- Clicking the backdrop or X closes the modal
- Pressing Escape closes the modal
- Clicking a second polygon after closing the modal: new loading → new modal

- [ ] **Step 3: Test gain polygons**

Click a gain polygon. Verify same behavior with green "Canopy Gain" header.

- [ ] **Step 4: Test no historical imagery**

Find a location where Street View coverage only exists after 2015. Verify the modal shows only the current image with "No 2015 or earlier imagery available" in a dashed box on the left/top.

- [ ] **Step 5: Test without API key**

Stop the dev server. Remove or empty the key in `web-app/.env`:

```
VITE_GOOGLE_MAPS_API_KEY=
```

Restart the dev server. Click a tree polygon. Verify:
- No "Loading..." text appears
- The popup shows the regular "Open in Google Street View" link (original behavior)
- No console errors related to Google Maps

Restore your API key in `.env` when done.

- [ ] **Step 6: Test mobile responsive layout**

Open browser DevTools, switch to a narrow mobile viewport (375px wide). Click a tree polygon. Verify:
- The modal images stack vertically instead of side-by-side
- The modal is scrollable if content exceeds the viewport
- All text and buttons are readable

- [ ] **Step 7: Commit any fixes from testing**

If any issues were found and fixed during verification, commit them:

```bash
git add -u
git commit -m "Fix issues found during Street View imagery manual testing"
```
