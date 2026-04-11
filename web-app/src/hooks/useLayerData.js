import { useState, useEffect, useRef } from 'react'

/**
 * Fetches a GeoJSON boundary layer and caches it by layer ID.
 * Subsequent calls with the same layerId return the cached data immediately.
 *
 * Returns { data, loading, error }
 */
export function useLayerData(layerId, fileUrl) {
  const cache = useRef({})
  const [state, setState] = useState({ data: null, loading: false, error: null })

  useEffect(() => {
    if (!fileUrl) {
      setState({ data: null, loading: false, error: null })
      return
    }

    // Return cached data immediately if already loaded
    if (cache.current[layerId]) {
      setState({ data: cache.current[layerId], loading: false, error: null })
      return
    }

    setState(s => ({ ...s, loading: true, error: null }))

    fetch(fileUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${fileUrl}`)
        return res.json()
      })
      .then(data => {
        cache.current[layerId] = data
        setState({ data, loading: false, error: null })
      })
      .catch(err => {
        console.error('Failed to load layer:', fileUrl, err)
        setState({ data: null, loading: false, error: err.message })
      })
  }, [layerId, fileUrl])

  return state
}

/**
 * Given a GeoJSON FeatureCollection and a numeric property name,
 * compute N quantile break values for use in a stepped colour scale.
 *
 * For diverging data (negative = loss, positive = gain), set
 * divergeAtZero=true to force 0 as the middle break so that the
 * bottom 3 colours are always < 0% and the top 3 are always >= 0%.
 */
export function computeQuantileBreaks(geojson, field, numBreaks = 5, divergeAtZero = false) {
  if (!geojson?.features?.length) return []

  const values = geojson.features
    .map(f => f.properties?.[field])
    .filter(v => v != null && !isNaN(v))
    .sort((a, b) => a - b)

  if (!values.length) return []

  if (divergeAtZero && numBreaks === 5) {
    const negatives = values.filter(v => v < 0)
    const positives = values.filter(v => v >= 0)

    // 2 breaks within negatives (at 1/3 and 2/3 quantiles)
    const b0 = negatives.length > 0
      ? parseFloat(negatives[Math.floor(negatives.length / 3)].toFixed(2))
      : 0
    const b1 = negatives.length > 0
      ? parseFloat(negatives[Math.floor(negatives.length * 2 / 3)].toFixed(2))
      : 0

    // Middle break is always 0
    const b2 = 0

    // 2 breaks within positives (at 1/3 and 2/3 quantiles)
    const b3 = positives.length > 0
      ? parseFloat(positives[Math.floor(positives.length / 3)].toFixed(2))
      : 0
    const b4 = positives.length > 0
      ? parseFloat(positives[Math.floor(positives.length * 2 / 3)].toFixed(2))
      : 0

    return [b0, b1, b2, b3, b4]
  }

  return Array.from({ length: numBreaks }, (_, i) => {
    const idx = Math.floor(((i + 1) / (numBreaks + 1)) * values.length)
    return parseFloat(values[idx].toFixed(2))
  })
}

/**
 * Build a MapLibre GL JS `step` expression that maps a numeric feature
 * property to a colour based on quantile breaks.
 *
 * Result: ['step', ['get', field], color0, break1, color1, break2, color2, …]
 */
export function buildColorExpression(field, breaks, colors) {
  if (!breaks.length) return colors[0]
  const expr = ['step', ['coalesce', ['get', field], 0], colors[0]]
  breaks.forEach((b, i) => expr.push(b, colors[i + 1] ?? colors[colors.length - 1]))
  return expr
}
