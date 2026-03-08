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
    if (!fileUrl) return

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
 * Skips zero values so the "no loss" colour is always the first step.
 */
export function computeQuantileBreaks(geojson, field, numBreaks = 5) {
  if (!geojson?.features?.length) return []

  const values = geojson.features
    .map(f => f.properties?.[field])
    .filter(v => v != null && !isNaN(v) && v > 0)
    .sort((a, b) => a - b)

  if (!values.length) return []

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
