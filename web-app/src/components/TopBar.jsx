import { useState, useMemo, useRef } from 'react'
import { trackEvent } from '../utils/analytics'

export default function TopBar({
  activeLayer,    // { id, label, singularLabel, nameField, searchPlaceholder }
  layerData,      // GeoJSON FeatureCollection | null
  selectedFeatureName, // string | null
  onFeatureSelect,     // (name: string | null) => void
  onShare,             // () => Promise<boolean>
  onReset,             // () => void
  isMobile,            // boolean
  onMobileSearch,      // () => void  — opens bottom sheet to search
  onHelpOpen,          // () => void  — opens help modal
}) {
  const [query, setQuery]           = useState('')
  const [focused, setFocused]       = useState(false)
  const [shareToast, setShareToast] = useState(false)
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
    trackEvent('feature_select', { name, boundary_layer: activeLayer?.id })
  }

  function handleClear() {
    onFeatureSelect(null)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function handleShare() {
    const ok = await onShare()
    if (ok) {
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2000)
    }
  }

  const showDropdown = focused && filtered.length > 0 && !selectedFeatureName

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
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                placeholder={activeLayer?.searchPlaceholder || `Find your ${activeLayer?.singularLabel || 'neighborhood'}…`}
              />
            )}
          </div>
          {showDropdown && (
            <div className="top-bar-search-dropdown">
              {filtered.map(name => (
                <div key={name} className="search-result" onMouseDown={() => handleSelect(name)}>
                  {name}
                </div>
              ))}
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
        <button
          className={`top-bar-icon-btn${shareToast ? ' active' : ''}`}
          onClick={handleShare}
          title={shareToast ? 'Copied!' : 'Copy share link'}
        >
          {shareToast ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          )}
        </button>
        <button className="top-bar-icon-btn" onClick={onReset} title="Reset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
        </button>
      </div>
    </header>
  )
}
