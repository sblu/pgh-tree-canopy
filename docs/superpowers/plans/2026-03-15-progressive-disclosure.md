# Progressive Disclosure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the sidebar into a narrative advocacy journey with progressive disclosure, mobile bottom sheet support, and call-to-action integration.

**Architecture:** The sidebar is restructured into a Primary zone (guided, stage-driven content) and an Advanced zone (collapsible "More options" with all power-user controls). An `explorationStage` state machine in App.jsx drives what the sidebar shows. MapView gains two callback props (`onZoom`, `onStreetViewClose`) to feed stage transitions. On mobile (<768px), the sidebar becomes a bottom sheet with peek/expanded/full states.

**Tech Stack:** React 19, MapLibre GL JS, react-map-gl, CSS custom properties, localStorage, CSS media queries, touch events for bottom sheet drag.

**Spec:** `docs/superpowers/specs/2026-03-15-progressive-disclosure-design.md`

---

## Chunk 1: Foundation — State Machine, MapView Callbacks, Config

### Task 1: Add CTA links and prompt card config to layers.js

**Files:**
- Modify: `web-app/src/config/layers.js`

- [ ] **Step 1: Add exploration stage constants and prompt card config**

Add to the end of `web-app/src/config/layers.js`:

```js
// ---------------------------------------------------------------------------
// Progressive disclosure — exploration stages & prompt cards
// ---------------------------------------------------------------------------

export const EXPLORATION_STAGES = ['landing', 'neighborhood', 'street-level', 'post-streetview', 'exploring']

export const PROMPT_CARDS = {
  landing: {
    headline: "Pittsburgh's tree canopy is shrinking.",
    body: 'Between 2015 and 2020, neighborhoods across the city experienced significant canopy loss. Find yours to see the impact.',
    borderColor: 'var(--accent)',
  },
  'street-level': {
    headline: 'You can see the tree losses now.',
    body: null, // body is dynamic: "Click/Tap one to see the before & after Street View."
    borderColor: '#ef8a62',
  },
  // 'neighborhood' card is dynamic (built from selected feature data)
  // 'post-streetview' and 'exploring' have no prompt card
}

export const CTA_LINKS = {
  freeTree: {
    label: 'Request a Free Tree',
    description: 'City of Pittsburgh property owners',
    url: 'https://shuc.org/wp-content/uploads/2024/10/SHUC-Tree-Request-Form-2024.pdf',
    emoji: '\u{1F333}',
  },
  treeCaptain: {
    label: 'Become a Tree Captain',
    description: 'Lead tree planting in your community',
    url: 'https://shuc.org/wp-content/uploads/2025/02/Squirrel-Hill-Tree-Captain-Overview.pdf',
    emoji: '\u{1F3D8}\uFE0F',
  },
  volunteer: {
    label: 'Volunteer with SHUC',
    description: 'Join the Tree Committee',
    url: 'https://shuc.org',
    emoji: '\u{1F91D}',
  },
}

export const LOCAL_STORAGE_KEY = 'pghCanopyExplorer'
```

- [ ] **Step 2: Verify the app still loads**

Run: `cd web-app && npm run dev`

Open browser, confirm app loads without errors. The new exports are unused so far — no visual changes expected.

- [ ] **Step 3: Commit**

```bash
git add web-app/src/config/layers.js
git commit -m "Add exploration stage config, prompt cards, and CTA links"
```

---

### Task 2: Add MapView callback props (onZoom, onStreetViewClose)

**Files:**
- Modify: `web-app/src/components/MapView.jsx`

- [ ] **Step 1: Add `onZoom` and `onStreetViewClose` to MapView props**

In `MapView.jsx`, add the two new props to the destructured parameter list (after `onFlyToComplete`):

```js
  onZoom,
  onStreetViewClose,
```

- [ ] **Step 2: Add `onMoveEnd` handler to the `<Map>` component**

Find the `<Map` JSX element in MapView.jsx. Add an `onMoveEnd` prop:

```js
onMoveEnd={e => {
  if (onZoom) onZoom(e.target.getZoom())
}}
```

- [ ] **Step 3: Wire `onStreetViewClose` into the StreetViewModal close handler**

Find the `<StreetViewModal` JSX near the end of MapView.jsx. Change its `onClose` prop from:

```js
onClose={() => setClickedTree(null)}
```

to:

```js
onClose={() => {
  setClickedTree(null)
  if (onStreetViewClose) onStreetViewClose()
}}
```

- [ ] **Step 4: Verify the app still loads**

Run: `cd web-app && npm run dev`

Open browser, confirm app loads and Street View modal still works (click a tree loss polygon → modal opens → close works). No visual changes expected since App.jsx isn't passing these props yet.

- [ ] **Step 5: Commit**

```bash
git add web-app/src/components/MapView.jsx
git commit -m "Add onZoom and onStreetViewClose callback props to MapView"
```

---

### Task 3: Add exploration state machine to App.jsx

**Files:**
- Modify: `web-app/src/App.jsx`

- [ ] **Step 1: Add imports for new config**

Add to the existing import from `./config/layers`:

```js
LOCAL_STORAGE_KEY
```

- [ ] **Step 2: Add localStorage helper functions**

Add before the `App` function:

```js
function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed[key] ?? fallback
  } catch { return fallback }
}

function saveStorage(key, value) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    obj[key] = value
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj))
  } catch { /* ignore */ }
}
```

- [ ] **Step 3: Add new state variables inside App()**

Add after the existing state declarations (after `const watchIdRef = useRef(null)`):

```js
// Progressive disclosure state
const [explorationStage, setExplorationStage]   = useState('landing')
const [currentZoom, setCurrentZoom]             = useState(11)
const [hasViewedStreetView, setHasViewedStreetView] = useState(false)
const [advancedExpanded, setAdvancedExpanded]   = useState(() => loadStorage('advancedExpanded', false))
const [ctaDismissed, setCtaDismissed]           = useState(() => loadStorage('ctaDismissed', false))
```

- [ ] **Step 4: Change default activeMethodId**

Change the initial value of `activeMethodId` from `'canopy_2020_pct'` to `'net_pct_of_area'`:

```js
const [activeMethodId, setActiveMethodId] = useState('net_pct_of_area')
```

- [ ] **Step 5: Add stage transition effects**

Add after the geolocation `useEffect` block:

```js
// Stage transitions (forward-only)
useEffect(() => {
  if (explorationStage === 'landing' && selectedFeatureName) {
    setExplorationStage('neighborhood')
    saveStorage('hasVisited', true)
  }
}, [explorationStage, selectedFeatureName])

useEffect(() => {
  if (explorationStage === 'neighborhood' && selectedFeatureName && currentZoom >= 12) {
    setExplorationStage('street-level')
  }
}, [explorationStage, selectedFeatureName, currentZoom])

useEffect(() => {
  if (explorationStage === 'street-level' && hasViewedStreetView) {
    setExplorationStage('post-streetview')
  }
}, [explorationStage, hasViewedStreetView])
```

- [ ] **Step 6: Add callback handlers for new MapView props**

Add after `handlePanToLocation`:

```js
const handleZoom = useCallback(zoom => {
  setCurrentZoom(zoom)
}, [])

const handleStreetViewClose = useCallback(() => {
  setHasViewedStreetView(true)
}, [])

const handleAdvancedToggle = useCallback(expanded => {
  setAdvancedExpanded(expanded)
  saveStorage('advancedExpanded', expanded)
}, [])

const handleCtaDismiss = useCallback(() => {
  setCtaDismissed(true)
  saveStorage('ctaDismissed', true)
  setExplorationStage('exploring')
}, [])

const resetExploration = useCallback(() => {
  setExplorationStage('landing')
  setSelectedFeatureName(null)
  setHoveredFeature(null)
}, [])
```

- [ ] **Step 7: Pass new props to MapView**

Add `onZoom` and `onStreetViewClose` props to the `<MapView>` JSX:

```js
onZoom={handleZoom}
onStreetViewClose={handleStreetViewClose}
```

- [ ] **Step 8: Pass new props to Sidebar**

Add these props to the `<Sidebar>` JSX (we'll consume them in the next task):

```js
explorationStage={explorationStage}
currentZoom={currentZoom}
advancedExpanded={advancedExpanded}
onAdvancedToggle={handleAdvancedToggle}
ctaDismissed={ctaDismissed}
onCtaDismiss={handleCtaDismiss}
onReset={resetExploration}
selectedFeatureName={selectedFeatureName}
```

- [ ] **Step 9: Verify the app loads and stage transitions work**

Run: `cd web-app && npm run dev`

Open browser console. Select a neighborhood → confirm no errors. Zoom in → confirm no errors. Click a tree loss → open/close Street View → confirm no errors. The sidebar still renders the old layout (new props are passed but not consumed yet).

- [ ] **Step 10: Commit**

```bash
git add web-app/src/App.jsx
git commit -m "Add exploration state machine and stage transitions to App"
```

---

## Chunk 2: Sidebar Restructure — Primary + Advanced Zones

### Task 4: Restructure Sidebar.jsx — Primary zone with prompt cards

**Files:**
- Modify: `web-app/src/components/Sidebar.jsx`

This is the largest task. The sidebar is rewritten to show the Primary zone (header, search, prompt card, leaderboard, CTA, dynamic legend) and the Advanced zone ("More options" collapsible).

- [ ] **Step 1: Update imports and props**

Replace the import line and props destructuring at the top of Sidebar.jsx:

```jsx
import { useMemo, useState } from 'react'
import {
  BOUNDARY_LAYERS, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS,
  TREE_LOSS_COLORS, TREE_GAIN_COLORS, STREET_BUFFER_COLOR,
  CANOPY_CHANGE_COLORS, PROMPT_CARDS, CTA_LINKS, LOCAL_STORAGE_KEY,
} from '../config/layers'
import Leaderboard from './Leaderboard'

export default function Sidebar({
  activeBoundaryLayerId,
  onBoundaryLayerChange,
  activeMethodId,
  onMethodChange,
  showTreeLosses,
  onShowTreeLossesChange,
  showTreeGains,
  onShowTreeGainsChange,
  showStreetBuffer,
  onShowStreetBufferChange,
  showCanopyChange,
  onShowCanopyChangeChange,
  layerData,
  colorBreaks,
  onFeatureSelect,
  onHover,
  onHoverEnd,
  showLocation,
  onShowLocationChange,
  userLocation,
  locationError,
  locationAvailable,
  onPanToLocation,
  // New progressive disclosure props
  explorationStage,
  currentZoom,
  advancedExpanded,
  onAdvancedToggle,
  ctaDismissed,
  onCtaDismiss,
  onReset,
  selectedFeatureName,
}) {
```

- [ ] **Step 2: Keep existing computed values, add isTouchDevice helper**

Keep the existing `searchQuery`, `searchFocused`, `activeLayer`, `featureNames`, `filteredNames`, `handleSelect`, `activeMethod`, `isCoverage`, `paletteColors`, and `legendSteps` logic exactly as-is.

Add after the existing state/memos:

```jsx
const isTouchDevice = useMemo(() => window.matchMedia('(hover: none)').matches, [])
const clickOrTap = isTouchDevice ? 'Tap' : 'Click'

const hasVisited = useMemo(() => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw).hasVisited : false
  } catch { return false }
}, [])

// Build the neighborhood insight card dynamically
const neighborhoodCard = useMemo(() => {
  if (!selectedFeatureName || !layerData?.features) return null
  const feature = layerData.features.find(f => f.properties?.name === selectedFeatureName)
  if (!feature) return null
  const p = feature.properties
  const method = COLOR_METHODS.find(m => m.id === activeMethodId)
  const isCoverageMetric = method?.group === 'coverage'
  const value = p[activeMethodId]
  if (value == null) return null
  const isLoss = !isCoverageMetric && value < 0
  return {
    headline: selectedFeatureName,
    stat: isCoverageMetric ? `${value.toFixed(1)}%` : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
    statColor: isCoverageMetric ? 'var(--sidebar-text)' : (isLoss ? '#f87171' : 'var(--accent)'),
    statLabel: method?.description || '',
    isLoss,
    isCoverage: isCoverageMetric,
  }
}, [selectedFeatureName, layerData, activeMethodId])

const showAtStreetLevel = currentZoom >= 12
```

- [ ] **Step 3: Rewrite the JSX return — Primary zone**

Replace the entire `return (...)` block with the new structure. This is the full sidebar JSX:

```jsx
return (
  <aside className="sidebar">
    {/* ── Header ── */}
    <header className="sidebar-header">
      <img src="images/shuc-logo.png" alt="SHUC logo" className="sidebar-logo" />
      <div>
        <div className="sidebar-title">Pittsburgh Tree Canopy</div>
        <div className="sidebar-subtitle">2015–2020 Change</div>
      </div>
      {explorationStage !== 'landing' && (
        <button className="reset-btn" onClick={onReset} title="Reset to start">↺</button>
      )}
    </header>

    {/* ── Search ── */}
    <section className="sidebar-section">
      <div className="section-label">
        {selectedFeatureName ? (activeLayer?.label || 'Selected') : 'Find Your Neighborhood'}
      </div>
      <div className="search-container">
        {selectedFeatureName ? (
          <div
            className="search-selected"
            onClick={() => { onFeatureSelect(null); setSearchQuery('') }}
          >
            {selectedFeatureName} <span className="search-clear">&times;</span>
          </div>
        ) : (
          <input
            className="search-input"
            type="text"
            placeholder={activeLayer?.searchPlaceholder ?? 'Search…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
        )}
        {searchFocused && !selectedFeatureName && filteredNames.length > 0 && (
          <ul className="search-results">
            {filteredNames.map(name => (
              <li key={name} onMouseDown={() => handleSelect(name)}>
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>

    {/* ── Prompt Card ── */}
    {explorationStage === 'landing' && !hasVisited && (
      <div className="prompt-card" style={{ borderLeftColor: PROMPT_CARDS.landing.borderColor }}>
        <div className="prompt-headline">{PROMPT_CARDS.landing.headline}</div>
        <div className="prompt-body">{PROMPT_CARDS.landing.body}</div>
      </div>
    )}

    {explorationStage === 'neighborhood' && neighborhoodCard && (
      <div className="prompt-card" style={{ borderLeftColor: neighborhoodCard.isLoss ? '#f87171' : 'var(--accent)' }}>
        <div className="prompt-headline">{neighborhoodCard.headline}</div>
        <div className="prompt-body">
          {neighborhoodCard.isCoverage ? (
            <>
              Has{' '}
              <span style={{ color: neighborhoodCard.statColor, fontWeight: 600 }}>
                {neighborhoodCard.stat}
              </span>
              {' canopy coverage (2020).'}
            </>
          ) : (
            <>
              {neighborhoodCard.isLoss ? 'Lost ' : 'Gained '}
              <span style={{ color: neighborhoodCard.statColor, fontWeight: 600 }}>
                {neighborhoodCard.stat}
              </span>
              {' of its canopy between 2015–2020.'}
            </>
          )}
          <br />
          <span className="prompt-hint">{neighborhoodCard.statLabel}</span>
        </div>
        <div className="prompt-action">Zoom in to see where individual mature trees were lost →</div>
      </div>
    )}

    {explorationStage === 'street-level' && (
      <div className="prompt-card" style={{ borderLeftColor: PROMPT_CARDS['street-level'].borderColor }}>
        <div className="prompt-headline">{PROMPT_CARDS['street-level'].headline}</div>
        <div className="prompt-body">
          Each <span style={{ color: '#e74c3c' }}>■</span> red shape is a mature tree lost between 2015–2020.
          <br />
          <strong>{clickOrTap} one to see the before &amp; after Street View.</strong>
        </div>
      </div>
    )}

    {/* ── Leaderboard (appears at neighborhood stage or later) ── */}
    {explorationStage !== 'landing' && activeLayer?.file && (
      <Leaderboard
        layerData={layerData}
        activeMethodId={activeMethodId}
        onHover={onHover}
        onHoverEnd={onHoverEnd}
        onFeatureSelect={onFeatureSelect}
        defaultOpen={explorationStage === 'neighborhood'}
        label="How Others Compare"
      />
    )}

    {/* ── CTA Section ── */}
    {explorationStage === 'post-streetview' && !ctaDismissed ? (
      <div className="cta-prominent">
        <div className="cta-prominent-title">Help Restore Pittsburgh's Canopy</div>
        <div className="cta-prominent-body">
          Every tree matters. Here's how you can make a difference in your neighborhood:
        </div>
        <div className="cta-actions">
          {Object.values(CTA_LINKS).map(link => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="cta-action-btn">
              <span className="cta-action-emoji">{link.emoji}</span>
              <div>
                <div className="cta-action-label">{link.label}</div>
                <div className="cta-action-desc">{link.description}</div>
              </div>
            </a>
          ))}
        </div>
        <button className="cta-dismiss" onClick={onCtaDismiss}>Dismiss</button>
      </div>
    ) : (
      <div className="cta-subtle">
        <span className="cta-subtle-emoji">🌱</span>
        <span className="cta-subtle-text">
          Want to help?{' '}
          <a href="https://shuc.org" target="_blank" rel="noreferrer">
            Learn how you can take action
          </a>
        </span>
      </div>
    )}

    {/* ── Dynamic Legend ── */}
    <section className="sidebar-section">
      {activeLayer?.file && (
        <>
          <div className="section-label">
            {isCoverage ? 'Canopy Coverage (2020)' : 'Net Canopy Change'}
          </div>
          {explorationStage === 'landing' && !advancedExpanded ? (
            <div className="legend-gradient-bar">
              <div className="legend-gradient-colors">
                {paletteColors.map((c, i) => (
                  <div key={i} style={{ background: c, flex: 1 }} />
                ))}
              </div>
              <div className="legend-gradient-labels">
                <span>{isCoverage ? 'Low' : 'Loss'}</span>
                <span>{isCoverage ? 'High' : 'Gain'}</span>
              </div>
            </div>
          ) : (
            legendSteps.map(({ color, label }) => (
              <div key={label} className="legend-row">
                <span className="legend-swatch" style={{ background: color }} />
                {label}
              </div>
            ))
          )}
        </>
      )}

      {showTreeLosses && showAtStreetLevel && (
        <>
          <div className="section-label" style={{ marginTop: '12px' }}>Mature Tree Losses</div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: TREE_LOSS_COLORS.tree }} />
            Single tree ≥ 0.04 acres
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: TREE_LOSS_COLORS.grove }} />
            Grove ≥ 0.07 acres
          </div>
        </>
      )}

      {showTreeGains && showAtStreetLevel && (
        <>
          <div className="section-label" style={{ marginTop: showTreeLosses ? '8px' : '12px' }}>Gains</div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: TREE_GAIN_COLORS.tree }} />
            Medium gain ≥ 0.04 acres
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: TREE_GAIN_COLORS.grove }} />
            Large gain ≥ 0.07 acres
          </div>
        </>
      )}

      {(showTreeLosses || showTreeGains) && showAtStreetLevel && (
        <div className="legend-note">Visible at zoom level 12+</div>
      )}

      {showStreetBuffer && showAtStreetLevel && (
        <>
          <div className="section-label" style={{ marginTop: '12px' }}>Street Buffer</div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: STREET_BUFFER_COLOR, opacity: 0.3 }} />
            50 ft road buffer
          </div>
        </>
      )}

      {showCanopyChange && showAtStreetLevel && (
        <>
          <div className="section-label" style={{ marginTop: '12px' }}>All Canopy Change</div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: CANOPY_CHANGE_COLORS.no_change }} />
            No change (2015–2020)
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: CANOPY_CHANGE_COLORS.gain }} />
            Canopy gain
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: CANOPY_CHANGE_COLORS.loss }} />
            Canopy loss
          </div>
          <div className="legend-note">Visible at zoom level 12+</div>
        </>
      )}
    </section>

    {/* ── Advanced Zone ("More options") ── */}
    <section className="advanced-zone">
      <button
        className="advanced-toggle"
        onClick={() => onAdvancedToggle(!advancedExpanded)}
      >
        <span className="advanced-toggle-icon">⚙</span>
        <span>More options</span>
        <span className="advanced-chevron">{advancedExpanded ? '▾' : '▸'}</span>
      </button>

      {advancedExpanded && (
        <div className="advanced-content">
          {/* Boundary layer switcher */}
          <div className="advanced-sub">
            <div className="section-label">Boundary Layer</div>
            {BOUNDARY_LAYERS.map(layer => (
              <label key={layer.id} className="radio-row">
                <input
                  type="radio"
                  name="boundary"
                  value={layer.id}
                  checked={activeBoundaryLayerId === layer.id}
                  onChange={() => onBoundaryLayerChange(layer.id)}
                />
                <span>
                  {layer.label}
                  {layer.description && <span className="radio-description">{layer.description}</span>}
                </span>
              </label>
            ))}
          </div>

          {/* Color metric selector */}
          <div className="advanced-sub">
            <div className="section-label">Color By</div>
            {COLOR_METHODS.map(method => (
              <label key={method.id} className="radio-row">
                <input
                  type="radio"
                  name="method"
                  value={method.id}
                  checked={activeMethodId === method.id}
                  onChange={() => onMethodChange(method.id)}
                />
                <span>
                  {method.label}
                  <span className="radio-description">{method.description}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Map layer toggles */}
          <div className="advanced-sub">
            <div className="section-label">Map Layers</div>
            <label className="toggle-row">
              <span>Mature tree losses</span>
              <input type="checkbox" className="toggle-input"
                checked={showTreeLosses} onChange={e => onShowTreeLossesChange(e.target.checked)} />
              <span className="toggle-pill" />
            </label>
            <label className="toggle-row">
              <span>Significant gains</span>
              <input type="checkbox" className="toggle-input"
                checked={showTreeGains} onChange={e => onShowTreeGainsChange(e.target.checked)} />
              <span className="toggle-pill" />
            </label>
            <label className="toggle-row">
              <span>Street tree areas only</span>
              <input type="checkbox" className="toggle-input"
                checked={showStreetBuffer} onChange={e => onShowStreetBufferChange(e.target.checked)} />
              <span className="toggle-pill" />
            </label>
            <label className="toggle-row">
              <span>All canopy changes</span>
              <input type="checkbox" className="toggle-input"
                checked={showCanopyChange} onChange={e => onShowCanopyChangeChange(e.target.checked)} />
              <span className="toggle-pill" />
            </label>
          </div>

          {/* My Location */}
          <div className="advanced-sub">
            <label className={`toggle-row${!locationAvailable ? ' disabled' : ''}`}>
              <span className="locate-label">
                My Location
                <span
                  className={`locate-dot${userLocation ? ' active' : ''}`}
                  role="button"
                  tabIndex={userLocation ? 0 : -1}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); if (userLocation) onPanToLocation() }}
                  title={userLocation ? 'Pan to my location' : 'Enable location first'}
                />
                {locationError && <span className="radio-description" style={{ color: '#f87171' }}>{locationError}</span>}
                {!locationAvailable && !locationError && <span className="radio-description">Requires HTTPS</span>}
              </span>
              <input type="checkbox" className="toggle-input"
                checked={showLocation} onChange={e => onShowLocationChange(e.target.checked)} disabled={!locationAvailable} />
              <span className="toggle-pill" />
            </label>
          </div>
        </div>
      )}
    </section>

    <footer className="sidebar-footer">
      Canopy data: Western PA Conservancy · 2015–2020<br />
      Data analysis:{' '}
      <a href="https://github.com/sblu/pgh-tree-canopy" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </footer>
  </aside>
)
```

- [ ] **Step 4: Verify the restructured sidebar renders**

Run: `cd web-app && npm run dev`

Open browser. The sidebar should now show:
- Header with Reset button (after selecting a neighborhood)
- Search bar with "Find Your Neighborhood" label
- Welcome prompt card at landing
- Selecting a neighborhood shows the insight card + leaderboard
- CTA subtle bar always visible
- Dynamic legend (compact gradient at landing, full rows when neighborhood selected)
- "More options" collapsed at bottom with all advanced controls inside

Test the full journey: search → select neighborhood → zoom in → click tree loss → Street View → close → prominent CTA → dismiss.

- [ ] **Step 5: Commit**

```bash
git add web-app/src/components/Sidebar.jsx
git commit -m "Restructure Sidebar into Primary + Advanced zones with prompt cards"
```

---

### Task 5: Update Leaderboard to accept `defaultOpen` and `label` props

**Files:**
- Modify: `web-app/src/components/Leaderboard.jsx`

- [ ] **Step 1: Update imports, props, and initial state**

Add `useEffect` to the import and update the component signature:

```jsx
import { useMemo, useState, useEffect } from 'react'
import { COLOR_METHODS } from '../config/layers'
```

```jsx
export default function Leaderboard({
  layerData,
  activeMethodId,
  onHover,
  onHoverEnd,
  onFeatureSelect,
  defaultOpen = true,
  label = 'Leaderboard',
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Sync with parent's defaultOpen when it changes (e.g., auto-collapse at street-level)
  useEffect(() => {
    setOpen(defaultOpen)
  }, [defaultOpen])
```

- [ ] **Step 2: Update the header label**

Change the button text from hardcoded "Leaderboard" to use the `label` prop:

```jsx
<span className="section-label" style={{ marginBottom: 0 }}>{label}</span>
```

- [ ] **Step 3: Verify leaderboard works**

Run: `cd web-app && npm run dev`

Select a neighborhood — leaderboard should appear expanded with "How Others Compare" label. Zoom to street level — leaderboard should auto-collapse. Manually re-opening it should still work.

- [ ] **Step 4: Commit**

```bash
git add web-app/src/components/Leaderboard.jsx
git commit -m "Add defaultOpen and label props to Leaderboard"
```

---

## Chunk 3: CSS — Desktop Styles + Mobile Bottom Sheet

### Task 6: Add CSS for prompt cards, CTA, advanced zone, and reset button

**Files:**
- Modify: `web-app/src/index.css`

- [ ] **Step 1: Add prompt card styles**

Add after the existing `.sidebar-footer` styles in index.css:

```css
/* ─── Prompt cards ───────────────────────────────────────────────────────── */
.prompt-card {
  margin: 12px 14px;
  padding: 14px;
  background: var(--input-bg);
  border-radius: 8px;
  border-left: 3px solid var(--accent);
}

.prompt-headline {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
}

.prompt-body {
  font-size: 11px;
  color: var(--sidebar-muted);
  line-height: 1.5;
}

.prompt-hint {
  font-size: 10px;
  color: var(--sidebar-muted);
}

.prompt-action {
  font-size: 11px;
  color: var(--sidebar-muted);
  font-style: italic;
  margin-top: 8px;
}
```

- [ ] **Step 2: Add CTA styles**

```css
/* ─── CTA section ────────────────────────────────────────────────────────── */
.cta-subtle {
  margin: 12px 14px;
  padding: 10px 12px;
  background: rgba(74, 222, 128, 0.08);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--accent);
}

.cta-subtle a {
  color: var(--accent);
  text-decoration: underline;
}

.cta-subtle-emoji {
  font-size: 14px;
}

.cta-prominent {
  margin: 14px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(74,222,128,0.12), rgba(34,197,94,0.06));
  border-radius: 10px;
  border: 1px solid rgba(74,222,128,0.2);
}

.cta-prominent-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--accent);
  margin-bottom: 8px;
}

.cta-prominent-body {
  font-size: 11px;
  color: var(--sidebar-muted);
  line-height: 1.5;
  margin-bottom: 12px;
}

.cta-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cta-action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--input-bg);
  border-radius: 6px;
  padding: 10px 12px;
  border: 1px solid var(--section-sep);
  color: var(--sidebar-text);
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.cta-action-btn:hover {
  border-color: var(--accent);
}

.cta-action-emoji {
  font-size: 16px;
}

.cta-action-label {
  font-weight: 600;
  font-size: 12px;
}

.cta-action-desc {
  font-size: 10px;
  color: var(--sidebar-muted);
  margin-top: 2px;
}

.cta-dismiss {
  display: block;
  margin: 8px auto 0;
  background: none;
  border: none;
  color: var(--sidebar-muted);
  font-size: 10px;
  cursor: pointer;
}

.cta-dismiss:hover {
  color: var(--sidebar-text);
}
```

- [ ] **Step 3: Add advanced zone and reset button styles**

```css
/* ─── Advanced zone ──────────────────────────────────────────────────────── */
.advanced-zone {
  border-top: 1px solid var(--section-sep);
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  color: var(--sidebar-muted);
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}

.advanced-toggle:hover {
  color: var(--sidebar-text);
}

.advanced-toggle-icon {
  font-size: 12px;
}

.advanced-chevron {
  margin-left: auto;
  font-size: 10px;
}

.advanced-content {
  border-top: 1px solid var(--section-sep);
}

.advanced-sub {
  padding: 10px 14px;
  border-bottom: 1px solid var(--section-sep);
}

.advanced-sub:last-child {
  border-bottom: none;
}

/* ─── Reset button ───────────────────────────────────────────────────────── */
.reset-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--section-sep);
  color: var(--sidebar-muted);
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
}

.reset-btn:hover {
  color: var(--sidebar-text);
  border-color: var(--sidebar-muted);
}

/* ─── Search selected pill ───────────────────────────────────────────────── */
.search-selected {
  background: var(--input-bg);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 8px 10px;
  color: var(--sidebar-text);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-clear {
  color: var(--sidebar-muted);
  font-size: 16px;
  margin-left: 8px;
}

.search-selected:hover .search-clear {
  color: var(--sidebar-text);
}

/* ─── Legend gradient bar (compact, landing stage) ────────────────────────── */
.legend-gradient-bar {
  margin-top: 4px;
}

.legend-gradient-colors {
  display: flex;
  height: 10px;
  border-radius: 2px;
  overflow: hidden;
}

.legend-gradient-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--sidebar-muted);
  margin-top: 2px;
}
```

- [ ] **Step 4: Verify desktop styles look correct**

Run: `cd web-app && npm run dev`

Walk through the full journey and verify:
- Welcome card has green left border
- Neighborhood card has red/green left border based on loss/gain
- Street-level card has orange left border
- CTA subtle bar is green-tinted
- CTA prominent card has gradient background
- "More options" toggle works, content appears with proper sections
- Reset button appears in header after selecting a neighborhood
- Legend shows compact bar at landing, full rows after neighborhood selection
- Selected neighborhood shows as a pill with ✕ clear button

- [ ] **Step 5: Commit**

```bash
git add web-app/src/index.css
git commit -m "Add CSS for prompt cards, CTA, advanced zone, reset, and search pill"
```

---

### Task 7: Add mobile bottom sheet CSS and touch handling

**Files:**
- Modify: `web-app/src/index.css`
- Modify: `web-app/src/components/Sidebar.jsx`
- Modify: `web-app/src/App.jsx`

- [ ] **Step 1: Add mobile media query and bottom sheet CSS to index.css**

Add at the end of index.css:

```css
/* ─── Mobile: bottom sheet ───────────────────────────────────────────────── */
@media (max-width: 767px) {
  .app-layout {
    flex-direction: column;
  }

  .sidebar-wrapper {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100% !important;
    min-width: 100% !important;
    height: auto;
    max-height: 90dvh;
    z-index: 20;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
    transition: transform 0.3s ease;
    overflow: hidden;
  }

  .sidebar-wrapper.collapsed {
    width: 100% !important;
    min-width: 100% !important;
    transform: none;
  }

  .sidebar {
    width: 100% !important;
    min-width: 100% !important;
    max-height: 90dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0;
  }

  /* Drag handle */
  .sheet-drag-handle {
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
    cursor: grab;
    touch-action: none;
  }

  .sheet-drag-handle-bar {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--sidebar-muted);
    opacity: 0.5;
  }

  /* Bottom sheet states */
  .sidebar-wrapper[data-sheet="peek"] {
    max-height: 60px;
    overflow: hidden;
  }

  .sidebar-wrapper[data-sheet="expanded"] {
    max-height: 60dvh;
  }

  .sidebar-wrapper[data-sheet="full"] {
    max-height: 90dvh;
  }

  /* Hide desktop sidebar toggle on mobile */
  .sidebar-toggle {
    display: none;
  }

  /* Peek bar: show handle + header + first search section only */
  .sidebar-wrapper[data-sheet="peek"] .prompt-card,
  .sidebar-wrapper[data-sheet="peek"] .cta-subtle,
  .sidebar-wrapper[data-sheet="peek"] .cta-prominent,
  .sidebar-wrapper[data-sheet="peek"] .leaderboard-section,
  .sidebar-wrapper[data-sheet="peek"] .advanced-zone,
  .sidebar-wrapper[data-sheet="peek"] .sidebar-footer {
    display: none;
  }

  /* Hide all sidebar-sections in peek EXCEPT the search section (first one) */
  .sidebar-wrapper[data-sheet="peek"] .sidebar-section ~ .sidebar-section {
    display: none;
  }

  .sidebar-wrapper[data-sheet="peek"] .sidebar-header {
    padding: 8px 14px;
  }

  /* Map needs full height on mobile */
  .map-container {
    height: 100dvh;
  }

  /* Mobile CTA banner (post-streetview, shown over map, above sheet z-index 20) */
  .mobile-cta-banner {
    display: block;
    position: fixed;
    top: 10px;
    left: 10px;
    right: 10px;
    z-index: 25;
    background: linear-gradient(135deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95));
    border: 1px solid rgba(74,222,128,0.3);
    border-radius: 10px;
    padding: 12px;
    backdrop-filter: blur(8px);
  }

  .mobile-cta-banner .cta-prominent {
    margin: 0;
    border: none;
    background: none;
    padding: 0;
  }

  /* Search dropdown must work inside bottom sheet */
  .search-results {
    position: relative;
    top: auto;
  }

  /* Stack Street View images vertically on mobile */
  .sv-modal-images {
    flex-direction: column;
  }

  .sv-modal-image-wrapper {
    min-width: 100% !important;
  }
}

/* Hide mobile-only elements on desktop */
@media (min-width: 768px) {
  .sheet-drag-handle {
    display: none;
  }

  .mobile-cta-banner {
    display: none;
  }
}

/* Touch-aware text: "Tap" vs "Click" is handled in JS via isTouchDevice */
```

- [ ] **Step 2: Add drag handle and sheet state to Sidebar.jsx**

In Sidebar.jsx, add the drag handle as the first element inside `<aside className="sidebar">`:

```jsx
<div className="sheet-drag-handle">
  <div className="sheet-drag-handle-bar" />
</div>
```

- [ ] **Step 3: Add `sheetState` and reactive `isMobile` to App.jsx**

Add state for the bottom sheet in App.jsx after the other progressive disclosure state:

```js
const [sheetState, setSheetState] = useState('peek') // peek | expanded | full
const [isMobile, setIsMobile] = useState(
  () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
)
const sheetWrapperRef = useRef(null)

// Listen for viewport changes (resize, rotation)
useEffect(() => {
  const mq = window.matchMedia('(max-width: 767px)')
  const handler = e => setIsMobile(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [])
```

Add a `data-sheet` attribute and ref to the sidebar-wrapper div:

```jsx
<div
  className={`sidebar-wrapper${sidebarOpen ? '' : ' collapsed'}`}
  data-sheet={isMobile ? sheetState : undefined}
  ref={sheetWrapperRef}
>
```

- [ ] **Step 4: Add effect to auto-expand sheet on stage transitions and pass mobile props**

Add in App.jsx after the stage transition effects:

```js
// Mobile: auto-expand sheet when stage changes (except landing)
useEffect(() => {
  if (isMobile && explorationStage !== 'landing') {
    setSheetState('expanded')
  }
}, [explorationStage, isMobile])

// Mobile: auto-expand sheet when search is focused
const handleMobileSearchFocus = useCallback(() => {
  if (isMobile && sheetState === 'peek') {
    setSheetState('expanded')
  }
}, [isMobile, sheetState])
```

Pass `onMobileSearchFocus` to Sidebar:

```jsx
onMobileSearchFocus={handleMobileSearchFocus}
```

In Sidebar.jsx, add `onMobileSearchFocus` to the props and wire it to the search input's `onFocus`:

```jsx
onFocus={() => { setSearchFocused(true); if (onMobileSearchFocus) onMobileSearchFocus() }}
```

Add the mobile CTA banner JSX in App.jsx, inside the `<main className="map-container">` element, after the sidebar toggle button:

```jsx
{/* Mobile: prominent CTA banner shown over map */}
{isMobile && explorationStage === 'post-streetview' && !ctaDismissed && (
  <div className="mobile-cta-banner">
    <div className="cta-prominent">
      <div className="cta-prominent-title">Help Restore Pittsburgh's Canopy</div>
      <div className="cta-prominent-body">
        Every tree matters. Here's how you can make a difference:
      </div>
      <div className="cta-actions">
        {Object.values(CTA_LINKS).map(link => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="cta-action-btn">
            <span className="cta-action-emoji">{link.emoji}</span>
            <div>
              <div className="cta-action-label">{link.label}</div>
              <div className="cta-action-desc">{link.description}</div>
            </div>
          </a>
        ))}
      </div>
      <button className="cta-dismiss" onClick={handleCtaDismiss}>Dismiss</button>
    </div>
  </div>
)}
```

Add `CTA_LINKS` to the import from `./config/layers` in App.jsx.

- [ ] **Step 5: Add touch drag handling for the bottom sheet**

Add in App.jsx:

```js
// Mobile bottom sheet drag handling
const dragStartY = useRef(0)

useEffect(() => {
  if (!isMobile) return
  const wrapper = sheetWrapperRef.current
  const handle = wrapper?.querySelector('.sheet-drag-handle')
  if (!handle) return

  const onTouchStart = e => {
    dragStartY.current = e.touches[0].clientY
  }

  const onTouchEnd = e => {
    const deltaY = e.changedTouches[0].clientY - dragStartY.current
    const threshold = 50
    if (deltaY < -threshold) {
      // Swiped up
      setSheetState(prev => prev === 'peek' ? 'expanded' : 'full')
    } else if (deltaY > threshold) {
      // Swiped down
      setSheetState(prev => prev === 'full' ? 'expanded' : 'peek')
    }
  }

  handle.addEventListener('touchstart', onTouchStart, { passive: true })
  handle.addEventListener('touchend', onTouchEnd, { passive: true })
  return () => {
    handle.removeEventListener('touchstart', onTouchStart)
    handle.removeEventListener('touchend', onTouchEnd)
  }
}, [isMobile]) // sheetState not needed — setSheetState uses callback form
```

- [ ] **Step 6: Verify mobile layout**

Run: `cd web-app && npm run dev`

Open Chrome DevTools → toggle device toolbar (Ctrl+Shift+M) → select a phone viewport (e.g., iPhone 14). Verify:
- Sidebar appears as bottom sheet with drag handle
- Peek state shows only header
- Dragging up expands to ~60% then ~90%
- Dragging down collapses
- Selecting a neighborhood auto-expands the sheet
- Desktop sidebar toggle is hidden
- Map fills full screen behind the sheet

- [ ] **Step 7: Commit**

```bash
git add web-app/src/index.css web-app/src/components/Sidebar.jsx web-app/src/App.jsx
git commit -m "Add mobile bottom sheet layout with touch drag handling"
```

---

## Chunk 4: Polish and Verification

### Task 8: Handle edge cases and cleanup

**Files:**
- Modify: `web-app/src/App.jsx`
- Modify: `web-app/src/components/Sidebar.jsx`

- [ ] **Step 1: Verify edge cases**

Run `cd web-app && npm run dev` and test:
- Click ✕ on the search-selected pill → stage should NOT regress (stage effects are forward-only, `handleFeatureSelect(null)` just clears the name)
- In Advanced, select "None" boundary layer → search shows no results → no crash
- In `exploring` stage with a feature selected → the search-selected pill shows the feature name correctly
- Switch color metric to "Total canopy coverage (2020)" in Advanced → neighborhood insight card should say "Has XX.X% canopy coverage" instead of "Lost/Gained"

- [ ] **Step 4: Run ESLint**

Run: `cd web-app && npm run lint`

Fix any lint errors. Common issues to watch for:
- Unused imports from the old sidebar structure
- Missing deps in `useEffect` dependency arrays

- [ ] **Step 5: Build the production bundle**

Run: `cd web-app && npm run build`

Verify no build errors.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A web-app/src/
git commit -m "Fix lint errors and edge cases in progressive disclosure"
```

---

### Task 9: Final visual walkthrough and commit

**Files:** None (testing only)

- [ ] **Step 1: Desktop walkthrough**

Run: `cd web-app && npm run dev`

Complete walkthrough on desktop:
1. Landing: minimal sidebar, welcome card, search, compact legend, subtle CTA, "More options" collapsed
2. Search and select a neighborhood → insight card appears with stats, leaderboard appears
3. Zoom in past 12 → "You can see the tree losses now" prompt, tree loss legend appears
4. Click a red tree loss polygon → Street View opens
5. Close Street View → prominent CTA with 3 action buttons
6. Click Dismiss → exploring state, subtle CTA returns
7. Click "More options" → all controls available
8. Click Reset → back to landing state
9. Reload page → `hasVisited` skips welcome card, `advancedExpanded` remembered

- [ ] **Step 2: Mobile walkthrough**

Use Chrome DevTools device mode (iPhone 14 or similar):
1. Bottom sheet in peek state with drag handle
2. Drag up → sheet expands
3. Search for a neighborhood → sheet auto-expands, insight card shows
4. Drag down → peek state, map visible
5. Zoom in → sheet auto-expands with tree loss prompt
6. Click tree loss → Street View modal (images stacked vertically)
7. Close → sheet auto-expands with CTA

- [ ] **Step 3: Final commit if any last-minute fixes**

```bash
git add -A web-app/src/
git commit -m "Progressive disclosure: final polish and verification"
```
