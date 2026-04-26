import { useState, useMemo, useRef } from 'react'
import { trackEvent } from '../utils/analytics'
import { geocodeAddress } from '../services/geocode'

export default function TopBar({
  activeLayer,    // { id, label, singularLabel, nameField, searchPlaceholder }
  layerData,      // GeoJSON FeatureCollection | null
  selectedFeatureName, // string | null
  onFeatureSelect,     // (name: string | null) => void
  onAddressFound,      // ({ lat, lng, displayName }) => void
  onShare,             // () => Promise<boolean>
  onReset,             // () => void
  isMobile,            // boolean
  onMobileSearch,      // () => void  — opens bottom sheet to search
  onHelpOpen,          // () => void  — opens help modal
}) {
  const [query, setQuery]           = useState('')
  const [focused, setFocused]       = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [addressLookup, setAddressLookup] = useState({ status: 'idle', error: null }) // 'idle' | 'pending' | 'notfound' | 'error'
  const inputRef = useRef(null)

  const featureNames = useMemo(() => {
    if (!layerData?.features || !activeLayer?.nameField) return []
    return layerData.features
      .map(f => f.properties?.[activeLayer.nameField])
      .filter(Boolean)
      .sort()
  }, [layerData, activeLayer])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return featureNames
    return featureNames.filter(n => n.toLowerCase().includes(q))
  }, [featureNames, query])

  function handleSelect(name) {
    onFeatureSelect(name)
    setQuery('')
    setFocused(false)
    setAddressLookup({ status: 'idle', error: null })
    trackEvent('feature_select', { name, boundary_layer: activeLayer?.id })
  }

  function handleClear() {
    onFeatureSelect(null)
    setQuery('')
    setAddressLookup({ status: 'idle', error: null })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function handleAddressLookup() {
    const q = query.trim()
    if (!q || addressLookup.status === 'pending') return
    setAddressLookup({ status: 'pending', error: null })
    try {
      const hit = await geocodeAddress(q)
      if (!hit) {
        setAddressLookup({ status: 'notfound', error: null })
        trackEvent('address_search', { query: q, found: false })
        return
      }
      onAddressFound?.(hit)
      setQuery('')
      setFocused(false)
      setAddressLookup({ status: 'idle', error: null })
      trackEvent('address_search', { query: q, found: true })
    } catch (err) {
      setAddressLookup({ status: 'error', error: err.message })
    }
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    // Prefer an exact-match boundary feature; otherwise fall through to address lookup
    const q = query.trim().toLowerCase()
    const exact = featureNames.find(n => n.toLowerCase() === q)
    if (exact) { handleSelect(exact); return }
    if (filtered.length === 1) { handleSelect(filtered[0]); return }
    handleAddressLookup()
  }

  async function handleShare() {
    const ok = await onShare()
    if (ok) {
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2000)
    }
  }

  const trimmedQuery = query.trim()
  const showAddressRow = focused && trimmedQuery.length >= 3 && !selectedFeatureName
  const showDropdown = focused && !selectedFeatureName && (filtered.length > 0 || showAddressRow)

  return (
    <header className="top-bar">
      {/* Brand */}
      <a
        className="top-bar-brand"
        href="https://shuc.org/about-us/committees/parks-and-open-space-committee/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent('cta_click', { link: 'shuc_logo' })}
      >
        <img src="images/shuc-logo.png" alt="SHUC logo" className="top-bar-logo" />
        <div className="top-bar-titles">
          <div className="top-bar-title">Pittsburgh Tree Canopy</div>
          {!isMobile && <div className="top-bar-subtitle">Squirrel Hill Urban Coalition</div>}
        </div>
      </a>

      {/* Desktop search pill */}
      {!isMobile && (
        <div className="top-bar-search-wrap">
          <div className={`top-bar-search-pill${focused ? ' focused' : ''}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
            </svg>
            {selectedFeatureName ? (
              <button className="search-selected-chip" onClick={handleClear}>
                {selectedFeatureName}
                <span style={{ fontSize: '11px', opacity: 0.6 }}>✕</span>
              </button>
            ) : (
              <>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); if (addressLookup.status !== 'idle') setAddressLookup({ status: 'idle', error: null }) }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeLayer?.searchPlaceholder || `Find your ${activeLayer?.singularLabel || 'neighborhood'}…`}
                />
                {query.length > 0 && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    aria-label="Clear search"
                    onMouseDown={e => {
                      e.preventDefault()
                      setQuery('')
                      setAddressLookup({ status: 'idle', error: null })
                      inputRef.current?.focus()
                    }}
                  >
                    ✕
                  </button>
                )}
              </>
            )}
          </div>
          {showDropdown && (
            <div className="top-bar-search-dropdown">
              {filtered.slice(0, 8).map(name => (
                <div key={name} className="search-result" onMouseDown={() => handleSelect(name)}>
                  {name}
                </div>
              ))}
              {showAddressRow && (
                <div
                  className="search-result search-result--address"
                  onMouseDown={e => { e.preventDefault(); handleAddressLookup() }}
                >
                  <span className="search-result-pin" aria-hidden="true">📍</span>
                  <span className="search-result-label">
                    {addressLookup.status === 'pending'  ? `Searching for “${trimmedQuery}”…`
                     : addressLookup.status === 'notfound' ? `No address found for “${trimmedQuery}” in Allegheny County`
                     : addressLookup.status === 'error'    ? `Address search unavailable`
                     : <>Search address: <strong>{trimmedQuery}</strong></>}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile: search + help icons */}
      {isMobile && (
        <div className="top-bar-mobile-icons">
          <button className="top-bar-icon-btn" onClick={onMobileSearch} title="Search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
            </svg>
          </button>
          <button className="top-bar-icon-btn" onClick={onHelpOpen} title="Help">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="top-bar-actions">
        <div style={{ position: 'relative' }}>
          <button
            className={`top-bar-icon-btn${shareToast ? ' active' : ''}`}
            onClick={handleShare}
            title="Copy share link"
          >
            {shareToast ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            )}
          </button>
          {shareToast && (
            <div style={{ position: 'absolute', top: '36px', right: 0, background: 'var(--primary)', color: '#0d1a0d', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              Link copied
            </div>
          )}
        </div>
        <button className="top-bar-icon-btn" onClick={onReset} title="Reset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
        </button>
      </div>
    </header>
  )
}
