/**
 * Address geocoding via Nominatim (OpenStreetMap).
 *
 * Free, keyless, no backend required — fits the static-host constraint.
 * Per Nominatim ToS we only fire on user submit (no live typeahead).
 *
 * Results are restricted to Allegheny County, PA via a viewbox + bounded=1
 * so a query like "1512 Beechwood Blvd" cannot resolve to a same-named
 * street in another state.
 *
 * Future swap target: Google Places PlaceAutocompleteElement, once the
 * project's Maps Platform community/demo relationship is in place.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// Allegheny County rough bbox (lon, lat)
//   west, south, east, north
const ALLEGHENY_VIEWBOX = {
  west:  -80.36,
  south:  40.20,
  east:  -79.69,
  north:  40.67,
}

// Nominatim's viewbox parameter is comma-separated lon1,lat1,lon2,lat2
// (top-left, bottom-right) — i.e. west,north,east,south.
const VIEWBOX_PARAM = [
  ALLEGHENY_VIEWBOX.west,
  ALLEGHENY_VIEWBOX.north,
  ALLEGHENY_VIEWBOX.east,
  ALLEGHENY_VIEWBOX.south,
].join(',')

const cache = new Map()

/**
 * Geocode an address. Returns { lat, lng, displayName } or null when
 * Nominatim has no in-bbox match.
 *
 * Throws on network/HTTP errors so the UI can show a transient message.
 */
export async function geocodeAddress(query) {
  const q = (query || '').trim()
  if (!q) return null

  const key = q.toLowerCase()
  if (cache.has(key)) return cache.get(key)

  const params = new URLSearchParams({
    q,
    format:   'json',
    viewbox:  VIEWBOX_PARAM,
    bounded:  '1',
    limit:    '1',
    addressdetails: '0',
  })

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`Geocoder returned ${res.status}`)
  }
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) {
    cache.set(key, null)
    return null
  }
  const hit = data[0]
  const result = {
    lat:         parseFloat(hit.lat),
    lng:         parseFloat(hit.lon),
    displayName: hit.display_name,
  }
  cache.set(key, result)
  return result
}
