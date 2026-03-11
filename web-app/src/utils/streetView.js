/**
 * Builds a Google Street View URL positioned on the nearest street
 * centerline — offset 50 ft along the street for a better viewing
 * angle — and aimed toward the canopy polygon centroid.
 */
import nearestPointOnLine from '@turf/nearest-point-on-line'
import along from '@turf/along'
import bearing from '@turf/bearing'
import distance from '@turf/distance'
import { point, lineString } from '@turf/helpers'

// 50 feet in kilometres (turf's default unit)
const OFFSET_KM = 50 * 0.0003048

/**
 * Break a feature into individual LineString features.
 * MultiLineStrings become multiple LineStrings; LineStrings pass through.
 */
function toLineStrings(feature) {
  const geom = feature.geometry
  if (!geom) return []
  if (geom.type === 'LineString') return [feature]
  if (geom.type === 'MultiLineString') {
    return geom.coordinates.map(coords => lineString(coords))
  }
  return []
}

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
