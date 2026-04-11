# Visual Refresh — "Living Atlas" Design Spec

**Date:** 2026-04-10  
**Inspiration:** Google Stitch — `VisualRefresh-stitch.zip` (explorer_with_floating_ui, arbor_layer DESIGN.md)  
**Status:** Approved, ready for implementation planning

---

## 1. Creative Direction

Move from "software dashboard with a sidebar" to "immersive map with floating glass instruments." The map is the primary canvas; every control is a floating glass panel that sits on top of it. The look is dark, organic, editorial — inspired by the Stitch "Living Atlas" design system.

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Overall layout | Full floating panels | Map always 100 % viewport — no sidebar taking space |
| Mobile layout | Chips (top) + glass bottom sheet | Full map immersion on small screens |
| Header | Slim frosted top bar | Logo + search always visible; closest to Stitch web mockup |
| Boundary info card | Pins to top of leaderboard panel | Eliminates floating-card overlap problem; leaderboard and details feel connected |

---

## 3. Color Palette

All panel backgrounds use `rgba(13,15,12,α)` with `backdrop-filter: blur(24px)`.  
No 1px solid borders. Boundaries created by tonal difference + ghost borders only.

| Role | Value | Use |
|---|---|---|
| Base / body bg | `#0d0f0c` | html/body background (rarely visible) |
| Glass panel | `rgba(13,15,12,0.82)` | All floating panels |
| Glass panel (deep) | `rgba(10,12,10,0.90)` | Top bar, leaderboard (needs more opacity) |
| Primary (Lush Green) | `#9bfc96` | Active states, toggles on, highlights, accent text |
| Primary dim | `#57b458` | Active toggle knobs, secondary green |
| Secondary (Autumn Ember) | `#ff8f06` | Loss indicators, negative values |
| Text (on-surface) | `#fdfcf7` | Primary body text |
| Muted (on-surface-variant) | `#ababa7` | Secondary labels, inactive icons |
| Inactive | `#474845` | Disabled, placeholder |
| Ghost border | `rgba(155,252,150,0.11)` | All panel borders |
| Ghost border (subtle) | `rgba(155,252,150,0.07)` | Internal dividers |
| Ghost border (active) | `rgba(155,252,150,0.35)` | Active chip border |
| Existing choropleth scale | unchanged | Diverging amber→green, 0 % forced as middle |

---

## 4. Typography

Add to `index.html` (or via CSS `@import`):
```
https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap
```

| Use | Font | Weight | Size |
|---|---|---|---|
| App title | Manrope | 800 | 13 px |
| Panel titles, section heads | Manrope | 700 | 11 px, uppercase, letter-spacing 0.08em |
| Large stat numbers (info card) | Manrope | 800 | 16–18 px |
| Boundary names in leaderboard | Inter | 500 | 10 px |
| Chips, labels, body | Inter | 400/500 | 9–11 px |

---

## 5. Desktop Layout (≥ 768 px)

Map is `position: fixed; inset: 0` — always full viewport.  
All panels are `position: fixed` with appropriate `z-index`.

### 5.1 Z-index stack

```
100  Top bar
90   Left icon rail
80   Leaderboard panel, Controls panel, Legend panel
70   Zoom controls
10   MapLibre map
```

### 5.2 Top bar

- `position: fixed; top: 0; left: 0; right: 0; height: 48px; z-index: 100`
- Background: `rgba(10,12,10,0.90)` + `backdrop-filter: blur(24px)`
- Bottom border: `1px solid rgba(155,252,150,0.08)`
- **Left:** SHUC logo (32 px, links to SHUC site) + "Pittsburgh Tree Canopy" (Manrope 800, #9bfc96) + "Squirrel Hill Urban Coalition" (Inter 500, 10 px, #ababa7)
- **Center:** Search pill — `border-radius: 999px`, `max-width: 380px`, `flex: 1`, same search behavior as today
- **Right:** Share icon button + Reset icon button (both 28 px, rounded glass squares)

### 5.3 Left icon rail

- `position: fixed; top: 48px; left: 0; bottom: 0; width: 44px; z-index: 90`
- Background: `rgba(10,12,10,0.78)` + `backdrop-filter: blur(20px)`
- Right border: `1px solid rgba(155,252,150,0.07)`
- Icons (34 px, `border-radius: 10px`):
  - **Map** (always visually active — lush green bg)
  - **Leaderboard** (≡) — toggles the leaderboard panel open/closed; default open
  - *(separator)*
  - **My Location** (◎) — existing geolocation behavior

### 5.4 Leaderboard + Details panel

- `position: fixed; top: 48px; left: 44px; bottom: 0; width: 220px; z-index: 80`
- Background: `rgba(11,13,11,0.90)` + `backdrop-filter: blur(24px)`
- Right border: `1px solid rgba(155,252,150,0.08)`
- Slides in/out with `transform: translateX(-264px)` transition (0.25 s ease) when icon is toggled
- **When a boundary is selected:** a stats card is pinned to the top of the panel:
  - Border: `1px solid rgba(155,252,150,0.22)`, `background: rgba(155,252,150,0.07)`
  - Shows: boundary name (Manrope 700), land area, and a 2×2 grid of stats (net change, 2020 canopy, gained acres, lost acres) in large Manrope numerals
  - Dismiss (✕) clears the selection
- **Below the card (or at top if no selection):** scrollable ranked list — same as current leaderboard behavior (highlight row on hover, click to fly-to, rank number, bar, value)

### 5.5 Controls panel

- `position: fixed; top: 60px; right: 12px; width: 240px; z-index: 80`
- Glass card: `border-radius: 20px`, ghost border
- Collapsible: chevron (⌄/⌃) in header collapses to just the title bar; default expanded
- **Sections** (separated by ghost-border dividers, no solid lines):
  1. **View By** — boundary layer selector as pill chips (Neighborhoods, Districts, Streets, Parks, Municipalities); active chip gets primary bg
  2. **Color By** — three metric radio options (custom styled dots, not native radio)
  3. **Overlays** — toggle rows: Tree Losses, Tree Gains, Street Buffer, Full Canopy Layer; each with a custom green toggle switch (no OS styling)

### 5.6 Legend panel

- `position: fixed; bottom: 16px; right: 12px; width: 175px; z-index: 80`
- Glass card: `border-radius: 14px`
- Metric name (Manrope 700, uppercase, muted) + 6 color swatches with range labels
- Always visible; updates when metric changes

### 5.7 Zoom controls

- `position: fixed; bottom: 16px; left: 276px; z-index: 70`
- `276px` = rail (44px) + leaderboard panel (220px) + 12px gap — always clear of the leaderboard even when it is open
- Glass pill: + / − buttons separated by a ghost-border line
- No change from current behavior; just restyled

---

## 6. Mobile Layout (< 768 px)

### 6.1 Top bar

Same as desktop but slightly shorter (44 px). Logo + title on left only. A search icon button (🔍) on the right opens the bottom sheet to expanded state with the search field auto-focused. No search pill in the top bar on mobile — space is too tight.

### 6.2 Floating chips row

- `position: fixed; top: 44px; left: 0; right: 0; z-index: 80`
- Horizontally scrollable row of glass pill chips, centered, with 12 px padding
- Chips:
  - **Boundary chip** — shows active layer name + ▾; tap opens a compact floating glass sheet directly below the chip row listing all boundary layers to choose from
  - **Metric chip** — shows short metric name + ▾; same pattern — floating glass sheet with the three metric options
  - **Losses chip** — amber when active (direct toggle, no sheet)
  - **Gains chip** — green when active (direct toggle, no sheet)
- Chip style: `border-radius: 999px`, `backdrop-filter: blur(16px)`, ghost border; active states use primary/secondary color
- The floating selection sheet is dismissed by tapping anywhere outside it or selecting an option

### 6.3 Bottom sheet

- Replaces the current mobile sheet — same drag/swipe mechanic, restyled
- `border-radius: 20px 20px 0 0`, deep glass background, green ghost border top
- **Peek state** (~90 px): drag handle + selected boundary summary (name + key metric) OR landing CTA if nothing selected
- **Expanded state** (full height minus top bar): all controls (same as desktop controls panel) + leaderboard list below

---

## 7. Component Architecture

### Files to create

| File | Purpose |
|---|---|
| `src/components/TopBar.jsx` | Top bar: logo, search, share/reset buttons |
| `src/components/ControlsPanel.jsx` | Floating right panel: boundary, metric, overlay toggles |
| `src/components/LeaderboardPanel.jsx` | Left slide panel: selected boundary stats + ranked list |
| `src/components/LegendPanel.jsx` | Bottom-right color legend |
| `src/components/MobileChips.jsx` | Top chips row (mobile only) |
| `src/components/MobileSheet.jsx` | Bottom sheet container (mobile only) |

### Files to modify

| File | Change |
|---|---|
| `src/index.css` | Full rewrite: CSS variables, glass utilities, layout rules |
| `src/index.html` | Add Google Fonts link (Manrope + Inter) |
| `src/App.jsx` | New layout structure; wire new components; map fills full viewport |
| `src/components/MapView.jsx` | Remove sidebar offset; map fills full viewport |

### Files to delete

| File | Reason |
|---|---|
| `src/components/Sidebar.jsx` | Replaced by the 6 new components above |
| `src/components/Leaderboard.jsx` | Absorbed into LeaderboardPanel.jsx |

---

## 8. Preserved (No Change)

- All state management in `App.jsx`
- All hooks: `useLayerData`, `useStreetView`, `useUrlHash`
- All config: `layers.js`, `dataSource.js`
- All MapLibre GL rendering logic in `MapView.jsx` (source/layer/event handler code)
- `StreetViewModal.jsx` — no visual changes
- Google Analytics event tracking
- Diverging color scale logic and quantile breaks
- `?source=public` hidden toggle
- Shareable URL hash state

---

## 9. Key Constraints

- **No overlapping panels.** Each panel has a fixed screen zone. The leaderboard panel absorbs boundary details to eliminate the floating info card.
- **No solid borders.** Every visual boundary is a ghost border (`rgba(155,252,150,0.07–0.35)`) or a background tonal shift.
- **No OS-native form controls.** All radio buttons, checkboxes, toggles, and dropdowns are custom-styled.
- **Mobile-first gestures preserved.** Bottom sheet swipe behavior must be retained exactly.
- **Accessible.** Minimum 4.5:1 contrast for all text against panel backgrounds.
