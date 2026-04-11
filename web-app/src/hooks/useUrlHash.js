/**
 * useUrlHash — bidirectional sync between app state and URL hash parameters.
 *
 * Hash format:
 *   #lat=40.44&lng=-80.00&z=11&layer=neighborhoods&method=net_pct_of_2015_canopy
 *   &losses=1&gains=0&buffer=1&canopy=0&selected=Squirrel+Hill+South
 *   &tree=40.432,-79.923,loss
 *
 * On page load, reads hash → returns initial state overrides.
 * On state change, caller updates hash via writeHash().
 */
import { useCallback, useRef } from 'react'

const DEFAULTS = {
  lat: 40.4406,
  lng: -79.9959,
  z: 11,
  layer: 'neighborhoods',
  method: 'net_pct_of_2015_canopy',
  losses: true,
  gains: false,
  buffer: true,
  canopy: false,
  selected: null,
  tree: null,
}

/** Parse the current URL hash into a state object. */
export function parseHash() {
  const hash = window.location.hash.slice(1) // remove '#'
  if (!hash) return null

  const params = new URLSearchParams(hash)
  const state = {}

  if (params.has('lat')) state.lat = parseFloat(params.get('lat'))
  if (params.has('lng')) state.lng = parseFloat(params.get('lng'))
  if (params.has('z'))   state.z   = parseFloat(params.get('z'))
  if (params.has('layer'))  state.layer  = params.get('layer')
  if (params.has('method')) state.method = params.get('method')
  if (params.has('losses')) state.losses = params.get('losses') === '1'
  if (params.has('gains'))  state.gains  = params.get('gains') === '1'
  if (params.has('buffer')) state.buffer = params.get('buffer') === '1'
  if (params.has('canopy')) state.canopy = params.get('canopy') === '1'
  if (params.has('selected')) state.selected = decodeURIComponent(params.get('selected'))
  if (params.has('tree')) {
    const parts = params.get('tree').split(',')
    if (parts.length >= 3) {
      state.tree = {
        lat: parseFloat(parts[0]),
        lng: parseFloat(parts[1]),
        type: parts[2], // 'loss' or 'gain'
      }
    }
  }

  return state
}

/** Build a hash string from the current app state. */
export function buildHash({
  lat, lng, z, layer, method,
  losses, gains, buffer, canopy,
  selected, tree,
}) {
  const params = new URLSearchParams()

  // Always include viewport
  if (lat != null) params.set('lat', lat.toFixed(4))
  if (lng != null) params.set('lng', lng.toFixed(4))
  if (z != null)   params.set('z', z.toFixed(1))

  // Only include non-default values to keep URLs short
  if (layer && layer !== DEFAULTS.layer)   params.set('layer', layer)
  if (method && method !== DEFAULTS.method) params.set('method', method)
  if (losses !== DEFAULTS.losses) params.set('losses', losses ? '1' : '0')
  if (gains !== DEFAULTS.gains)   params.set('gains', gains ? '1' : '0')
  if (buffer !== DEFAULTS.buffer) params.set('buffer', buffer ? '1' : '0')
  if (canopy !== DEFAULTS.canopy) params.set('canopy', canopy ? '1' : '0')
  if (selected) params.set('selected', selected)
  if (tree) params.set('tree', `${tree.lat.toFixed(4)},${tree.lng.toFixed(4)},${tree.type}`)

  return params.toString()
}

/** Hook that provides writeHash and the initial state from URL. */
export function useUrlHash() {
  const initialState = useRef(parseHash())
  const writeTimeoutRef = useRef(null)

  const writeHash = useCallback((state) => {
    // Debounce hash updates to avoid excessive history entries during panning
    if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current)
    writeTimeoutRef.current = setTimeout(() => {
      const hash = buildHash(state)
      // Use replaceState to avoid creating history entries on every pan
      window.history.replaceState(null, '', `#${hash}`)
    }, 300)
  }, [])

  const getShareUrl = useCallback((state) => {
    const hash = buildHash(state)
    const base = window.location.href.split('#')[0]
    return `${base}#${hash}`
  }, [])

  return { initialState: initialState.current, writeHash, getShareUrl }
}
