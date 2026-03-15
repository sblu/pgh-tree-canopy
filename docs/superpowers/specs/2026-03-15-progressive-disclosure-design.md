# Progressive Disclosure: Guided Exploration Redesign

**Date:** 2026-03-15
**Status:** Draft
**Goal:** Transform the sidebar from a power-user GIS tool into a narrative advocacy journey that progressively reveals complexity as users explore.

## Context

The Pittsburgh Tree Canopy web app currently shows all controls at once in a 300px sidebar: layer switcher, color-by metrics, leaderboard, zoom-level toggles, and legend sections. Feedback indicates this is overwhelming for first-time visitors. The app serves two audiences:

1. **Community members / residents** who want to see what's happening with trees in their neighborhood
2. **SHUC staff / advocates** who need data for presentations and policy work

The app's mission is advocacy: raise awareness that Pittsburgh's canopy is declining, make it personal (your neighborhood, your street), make it visceral (Street View before/after), and drive action (tree captain signup, free tree requests).

## Design: Organic Progressive Reveal

Rather than a binary guided/explore mode toggle, the sidebar starts minimal and grows organically as the user explores. Controls appear when they become relevant. An always-accessible "More options" section gives power users immediate access to the full control set.

### Exploration State Machine

A single `explorationStage` state variable drives what the sidebar shows. It advances forward based on user actions and never auto-regresses (only the Reset button returns to `landing`).

| Stage | Trigger | Description |
|-------|---------|-------------|
| `landing` | App load | Welcome hook + search prompt |
| `neighborhood` | User selects a boundary feature | Stats for selected area + leaderboard + zoom hint |
| `street-level` | Zoom ≥ 12 with a feature selected | "Click a red shape" prompt + tree loss legend |
| `post-streetview` | First Street View modal close | Prominent CTA panel with action buttons |
| `exploring` | CTA dismissed | Steady-state exploring with contextual cards |

**Stage transition rules:**
- Stages only advance forward automatically (landing → neighborhood → street-level → post-streetview → exploring)
- Selecting a different neighborhood while at `street-level` or later does NOT regress to `neighborhood` — the insight card updates in place
- Zooming back out from street level does NOT regress — the prompt card updates contextually
- Reset button returns to `landing` and clears the selected feature
- If the user opens "More options" and changes boundary layer / color-by, the stage does not change

### Sidebar Structure

The sidebar is split into two zones:

#### Primary Zone (visible, changes with stage)

1. **Header** — Logo, title, subtitle. Reset button (↺) appears after leaving `landing` stage.

2. **Search** — Always visible. Label changes contextually ("Find your neighborhood" at landing, shows selected name with ✕ clear button when a feature is selected). The search field and behavior are the same as today but with updated labeling.

3. **Prompt Card Slot** — One contextual card at a time, with a colored left border. Content depends on current stage:
   - `landing`: "Pittsburgh's tree canopy is shrinking." + brief context about 2015–2020 decline
   - `neighborhood`: Selected area name, key stat (loss %), and hint to zoom in
   - `street-level`: "You can see the tree losses now." + instruction to click for Street View
   - `post-streetview` / `exploring`: No prompt card (CTA takes this space at post-streetview; at exploring, the card area is either empty or shows a contextual tip)

4. **Leaderboard** — Appears at `neighborhood` stage. Starts expanded, auto-collapses at `street-level` to save space. User can manually expand/collapse at any stage. Labeled "How Others Compare" to frame it as context, not just data.

5. **CTA Section** — Two tiers:
   - **Subtle (stages: landing, neighborhood, street-level, exploring):** Small green-tinted bar: "Want to help? Learn how you can take action." Clicking expands inline or links to a CTA panel.
   - **Prominent (stage: post-streetview):** Expanded card with gradient background, three action buttons:
     - "Request a Free Tree" → links to SHUC tree request form PDF
     - "Become a Tree Captain" → links to SHUC tree captain overview PDF
     - "Volunteer with SHUC" → links to shuc.org (or appropriate volunteer page)
   - "Dismiss" collapses prominent CTA back to subtle version and advances stage to `exploring`.

6. **Dynamic Legend** — Shows only legends relevant to what's currently visible:
   - Boundary choropleth legend (when a boundary layer is active) — compact horizontal gradient bar with "Loss" / "Gain" labels at landing; full legend rows when in advanced or when user has engaged deeper
   - Mature tree losses legend (when zoom ≥ 12 and tree losses layer is on)
   - Gains legend (when zoom ≥ 12 and gains layer is on)
   - Street buffer legend (when street buffer is on and zoom ≥ 12)
   - All canopy change legend (when that layer is on)

#### Advanced Zone ("More options")

A collapsible section at the bottom of the sidebar, collapsed by default.

Contains all power-user controls, organized in sub-sections:
- **Boundary Layer** — Radio group (None, Neighborhoods, City Council Districts, County Council Districts, Municipal Parks, County Parks, Municipalities County-wide, Streets)
- **Color By** — Radio group (Total canopy coverage 2020, Net change % of land area, Net change % of 2015 canopy)
- **Map Layers** — Toggle switches (Mature tree losses, Significant gains, Street tree areas only, All canopy changes)
- **My Location** — Toggle switch

When the user expands "More options", a `localStorage` flag is set so it stays expanded on future visits. This is the power-user fast path — open it once and the app remembers.

Changing settings in the Advanced zone updates the map and legend immediately but does NOT change the exploration stage.

### Persistence (localStorage)

Key: `canopyExplorer` (or similar namespace)

| Property | Type | Purpose |
|----------|------|---------|
| `advancedExpanded` | boolean | Remember if user opened the advanced section |
| `ctaDismissed` | boolean | Don't show prominent CTA again after dismissal |
| `hasVisited` | boolean | Return visitors skip the welcome prompt card and go straight to search-focused landing |

### Reset Behavior

The Reset button (↺ icon in header, visible after leaving `landing`):
- Sets `explorationStage` back to `landing`
- Clears selected feature / search
- Collapses leaderboard
- Collapses advanced section (but does NOT clear the `advancedExpanded` localStorage flag — if the user explicitly expanded it before, it re-opens on next interaction)
- Does NOT clear map position or zoom
- Does NOT change layer/color-by settings

### Default State Changes

The initial app load changes from the current defaults:

| Setting | Current Default | New Default | Reason |
|---------|----------------|-------------|--------|
| Color metric | `canopy_2020_pct` (coverage) | `net_pct_of_area` (net change) | Net change tells the decline story |
| Sidebar content | All controls visible | Minimal guided view | Progressive disclosure |
| Leaderboard | Visible, expanded | Hidden until neighborhood selected | Reduce initial clutter |
| My Location | Visible in sidebar | Moved to Advanced zone | Not essential to the narrative |

All other defaults (tree losses on, gains off, street buffer on, neighborhoods layer) remain the same.

## Component Changes

### Modified Components

**App.jsx:**
- Add `explorationStage` state (string enum)
- Add stage transition logic (effects that watch for triggers)
- Add `advancedExpanded` state (synced to localStorage)
- Add `ctaDismissed` state (synced to localStorage)
- Add `resetExploration` callback
- Pass new props to Sidebar

**Sidebar.jsx:**
- Major restructure: split into Primary and Advanced zones
- Render prompt cards based on `explorationStage`
- Render CTA section with two tiers
- Render "More options" collapsible with all current controls inside
- Show/hide leaderboard based on stage
- Show Reset button conditionally
- Dynamic legend that responds to current visible layers

**index.css:**
- New styles for prompt cards (left-bordered contextual cards)
- CTA section styles (subtle bar + prominent card with gradient)
- "More options" collapsible section styles
- Reset button styles
- Adjust leaderboard to support appearing/collapsing at different stages

### New Components

None anticipated — this is a restructure of Sidebar.jsx, not new components. If Sidebar.jsx grows too large, prompt cards and the CTA section could be extracted, but start with everything inline.

### Config Changes

**New: Prompt card content (in Sidebar.jsx or a small config object):**
- Stage-specific headline, body text, border color, optional action hint
- Defined as data so content is easy to adjust without touching layout logic

**New: CTA links (in config or Sidebar.jsx):**
- Free tree request URL
- Tree captain overview URL
- Volunteer URL

## Out of Scope

- App renaming (tracked separately — Task #8)
- Changes to the map itself (layer rendering, popups, Street View modal)
- Changes to data pipeline or data format
- Mobile-specific layout changes (can be a follow-up)
- Onboarding animations or transitions (start with instant show/hide, polish later)
- A/B testing or analytics on stage progression

## Open Questions

1. **Return visitors:** Should `hasVisited` skip the welcome prompt entirely, or show a shorter version? Leaning toward showing search immediately with no prompt card.
2. **Street View CTA timing:** Should the prominent CTA appear after the FIRST Street View close, or after a short delay / second view? Starting with first close, can adjust.
3. **Boundary layer change in guided mode:** If a user in `neighborhood` stage switches to City Council Districts via Advanced, should the insight card update to show council district stats? Yes — the card should be driven by the selected feature, not hardcoded to neighborhoods.
