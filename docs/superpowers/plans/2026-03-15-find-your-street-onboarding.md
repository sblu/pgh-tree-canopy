# "Find Your Street" Onboarding Path Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Find your street" choice to the landing card so users can bypass the neighborhood flow and go straight to street-level exploration.

**Architecture:** A `streetPath` boolean in App.jsx gates a parallel state machine transition (`landing → street-level`) and suppresses the street-level prompt card. Sidebar receives the flag and a callback to activate it. No new files — two existing files modified.

**Tech Stack:** React 19, existing progressive disclosure state machine in App.jsx

**Spec:** `docs/superpowers/specs/2026-03-15-find-your-street-onboarding-design.md`

---

## Chunk 1: Implementation

### Task 1: Add `streetPath` state and wiring to App.jsx

**Files:**
- Modify: `web-app/src/App.jsx`

- [ ] **Step 1: Add `streetPath` state**

After line 47 (`ctaDismissed` state), add:

```jsx
const [streetPath, setStreetPath]               = useState(false)
```

- [ ] **Step 2: Modify the `landing → neighborhood` transition to add `!streetPath` guard**

Change the existing `useEffect` at lines 105-110 from:

```jsx
useEffect(() => {
  if (explorationStage === 'landing' && selectedFeatureName) {
    setExplorationStage('neighborhood') // eslint-disable-line react-hooks/set-state-in-effect
    saveStorage('hasVisited', true)
  }
}, [explorationStage, selectedFeatureName])
```

to:

```jsx
useEffect(() => {
  if (explorationStage === 'landing' && selectedFeatureName && !streetPath) {
    setExplorationStage('neighborhood') // eslint-disable-line react-hooks/set-state-in-effect
    saveStorage('hasVisited', true)
  }
}, [explorationStage, selectedFeatureName, streetPath])
```

- [ ] **Step 3: Add new `landing → street-level` transition**

Immediately after the modified effect above, add a new `useEffect`:

```jsx
useEffect(() => {
  if (explorationStage === 'landing' && selectedFeatureName && streetPath) {
    setExplorationStage('street-level') // eslint-disable-line react-hooks/set-state-in-effect
    saveStorage('hasVisited', true)
  }
}, [explorationStage, selectedFeatureName, streetPath])
```

- [ ] **Step 4: Add `handleStreetPathStart` callback**

After `handleMobileSearchFocus` (line 166), add:

```jsx
const handleStreetPathStart = useCallback(() => {
  setStreetPath(true)
  handleBoundaryLayerChange('streets')
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

Note: `handleBoundaryLayerChange` is a plain function (not wrapped in `useCallback`), so including it in deps would cause unnecessary re-renders. The eslint-disable is intentional — the function identity is stable because it only references setters.

- [ ] **Step 5: Update `handleBoundaryLayerChange` to reset `streetPath` when layer changes away from streets**

Change the existing function at lines 252-256 from:

```jsx
function handleBoundaryLayerChange(id) {
  setActiveBoundaryLayerId(id)
  setSelectedFeatureName(null)
  setHoveredFeature(null)
}
```

to:

```jsx
function handleBoundaryLayerChange(id) {
  setActiveBoundaryLayerId(id)
  setSelectedFeatureName(null)
  setHoveredFeature(null)
  if (id !== 'streets') setStreetPath(false)
}
```

- [ ] **Step 6: Update `resetExploration` to clear `streetPath` and restore neighborhoods**

Change the existing callback at lines 168-173 from:

```jsx
const resetExploration = useCallback(() => {
  setExplorationStage('landing')
  setSelectedFeatureName(null)
  setHoveredFeature(null)
  setHasViewedStreetView(false)
}, [])
```

to:

```jsx
const resetExploration = useCallback(() => {
  setExplorationStage('landing')
  setSelectedFeatureName(null)
  setHoveredFeature(null)
  setHasViewedStreetView(false)
  setStreetPath(false)
  setActiveBoundaryLayerId('neighborhoods')
}, [])
```

- [ ] **Step 7: Pass new props to Sidebar**

In the `<Sidebar>` JSX (around line 301), add two new props after `onMobileSearchFocus`:

```jsx
streetPath={streetPath}
onStreetPathStart={handleStreetPathStart}
```

- [ ] **Step 8: Verify build**

Run: `cd web-app && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add web-app/src/App.jsx
git commit -m "Add streetPath state, transitions, and callbacks to App.jsx"
```

---

### Task 2: Update Sidebar with landing card actions and street path behavior

**Files:**
- Modify: `web-app/src/components/Sidebar.jsx`

- [ ] **Step 1: Add new props to the destructured parameter list**

After `onMobileSearchFocus,` (line 42), add:

```jsx
streetPath,
onStreetPathStart,
```

- [ ] **Step 2: Make the search label conditional on `streetPath`**

Change line 144 from:

```jsx
{selectedFeatureName ? (activeLayer?.label || 'Selected') : 'Find Your Neighborhood'}
```

to:

```jsx
{selectedFeatureName ? (activeLayer?.label || 'Selected') : (streetPath ? 'Find Your Street' : 'Find Your Neighborhood')}
```

- [ ] **Step 3: Add action links to the landing prompt card**

Change lines 178-183 from:

```jsx
{explorationStage === 'landing' && !hasVisited && (
  <div className="prompt-card" style={{ borderLeftColor: PROMPT_CARDS.landing.borderColor }}>
    <div className="prompt-headline">{PROMPT_CARDS.landing.headline}</div>
    <div className="prompt-body">{PROMPT_CARDS.landing.body}</div>
  </div>
)}
```

to:

```jsx
{explorationStage === 'landing' && !hasVisited && (
  <div className="prompt-card" style={{ borderLeftColor: PROMPT_CARDS.landing.borderColor }}>
    <div className="prompt-headline">{PROMPT_CARDS.landing.headline}</div>
    <div className="prompt-body">{PROMPT_CARDS.landing.body}</div>
    <div className="prompt-action" style={{ marginTop: '8px' }}>
      Find your neighborhood or{' '}
      <span
        role="button"
        tabIndex={0}
        onClick={onStreetPathStart}
        onKeyDown={e => e.key === 'Enter' && onStreetPathStart()}
        style={{ cursor: 'pointer', textDecoration: 'underline' }}
      >
        find your street
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 4: Suppress the street-level prompt card when `streetPath` is true**

Change line 213 from:

```jsx
{explorationStage === 'street-level' && (
```

to:

```jsx
{explorationStage === 'street-level' && !streetPath && (
```

- [ ] **Step 5: Verify build and lint**

Run: `cd web-app && npx eslint src/components/Sidebar.jsx && npm run build`
Expected: No lint errors in Sidebar.jsx, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web-app/src/components/Sidebar.jsx
git commit -m "Add find-your-street action links and street path behavior to Sidebar"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Test the neighborhood path (regression)**

1. Open https://localhost:5173/ and hard-refresh (Ctrl+Shift+R)
2. Landing card should show with "Find your neighborhood or find your street" links
3. Search label should say "Find Your Neighborhood"
4. Type a neighborhood name (e.g., "Squirrel Hill") and select it
5. Stage should advance to `neighborhood`, neighborhood insight card should appear
6. Zoom in past 12 → stage should advance to `street-level`, prompt card should appear

- [ ] **Step 2: Test the street path**

1. Click the reset button (↺) to return to landing
2. Click "find your street" link in the landing card
3. Search label should change to "Find Your Street"
4. Search placeholder should change to "Search streets…"
5. Type a street name and select it
6. Map should fly to the street at moderate zoom (~14)
7. No street-level prompt card should appear
8. Click a tree loss polygon → Street View should work normally
9. After viewing Street View, the CTA card should still appear at post-streetview stage

- [ ] **Step 3: Test edge cases**

1. While on the street path (before selecting a street), open "More options" and switch boundary to "Neighborhoods" → search should revert to "Find Your Neighborhood"
2. Click reset → should return to landing with neighborhoods selected
