/**
 * Google Maps SDK singleton — uses the importLibrary() bootstrap pattern.
 *
 * The bootstrap snippet installs a lightweight stub on `google.maps.importLibrary`
 * at module-import time.  No network request is made until the first actual
 * `importLibrary()` call, preserving lazy-loading behaviour.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

let bootstrapFailed = false
let rejectBootstrap = null // allows gm_authFailure to reject the pending promise

// Google calls this global function when the API key is invalid, the referrer
// is not allowed, or any other auth-level error occurs.  Without this handler
// the bootstrap promise hangs forever because the callback is never invoked.
window.gm_authFailure = () => {
  console.warn('[GoogleMaps] Auth failure (RefererNotAllowed / invalid key)')
  bootstrapFailed = true
  if (rejectBootstrap) {
    rejectBootstrap(new Error('Google Maps auth failure (check API key restrictions)'))
    rejectBootstrap = null
  }
}

// ── Bootstrap (runs once at import time) ────────────────────────────────
// Adapted from https://developers.google.com/maps/documentation/javascript/load-maps-js-api#dynamic-library-import
if (API_KEY) {
  try {
    ;((g) => {
      let h, a, k
      const p = 'The Google Maps JavaScript API'
      const c = 'google'
      const l = 'importLibrary'
      const q = '__ib__'
      const m = document
      let b = window
      b = b[c] || (b[c] = {})
      const d = b.maps || (b.maps = {})
      const r = new Set()
      const e = new URLSearchParams()
      const u = () =>
        h ||
        (h = new Promise(async (f, n) => {
          rejectBootstrap = n
          await (a = m.createElement('script'))
          e.set('libraries', [...r] + '')
          for (k in g)
            e.set(
              k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()),
              g[k]
            )
          e.set('callback', c + '.maps.' + q)
          a.src = `https://maps.googleapis.com/maps/api/js?` + e
          a.onerror = () => {
            h = null
            bootstrapFailed = true
            rejectBootstrap = null
            n(Error(p + ' could not load.'))
          }
          d[q] = (v) => { rejectBootstrap = null; f(v) }
          m.head.append(a)
          // Safety timeout: if Google never calls back (auth error, network),
          // reject after 15 seconds so the UI can fall back to a direct link.
          setTimeout(() => {
            if (rejectBootstrap === n) {
              bootstrapFailed = true
              rejectBootstrap = null
              n(Error(p + ' timed out.'))
            }
          }, 15000)
        }))
      d[l]
        ? console.warn(p + ' only loads once. Ignoring:', g)
        : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)))
    })({ key: API_KEY, v: 'weekly' })
  } catch {
    bootstrapFailed = true
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export function isBootstrapFailed() {
  return bootstrapFailed
}

export function markBootstrapFailed() {
  bootstrapFailed = true
}

/**
 * Thin wrapper around `google.maps.importLibrary()`.
 * Short-circuits with a rejection when the bootstrap has permanently failed.
 */
export function importLibrary(name) {
  if (bootstrapFailed) {
    return Promise.reject(new Error('Google Maps SDK previously failed to load'))
  }
  if (!window.google?.maps?.importLibrary) {
    return Promise.reject(new Error('Google Maps bootstrap was not installed'))
  }
  return window.google.maps.importLibrary(name)
}
