---
name: UI tweaks — wider resizable panel, prominent search, scroll-to-selected
description: Three visual improvements to the desktop leaderboard and search UX
type: spec
date: 2026-04-16
---

# UI Tweaks Design

## Scope

Three independent visual tweaks to the desktop web app:

1. Wider leaderboard panel with drag-to-resize
2. More prominent search box
3. Scroll leaderboard list to selected boundary when map is clicked

---

## 1. Wider + Resizable Leaderboard Panel

### What changes

**`web-app/src/index.css`**
- Increase `:root` `--lb-w` default: `220px` → `260px`

**`web-app/src/components/LeaderboardPanel.jsx`**
- Add `width` state, default `260` (no localStorage — resets each page load)
- Render a 4px-wide drag handle div, absolutely positioned on the right edge, full height, `cursor: col-resize`
- On `mousedown` on the handle: record `startX` and `startWidth`, attach `mousemove` and `mouseup` to `window`
- On `mousemove`: `newWidth = clamp(180, startWidth + (e.clientX - startX), 440)`, set state
- On `mouseup`: detach listeners
- Apply `style={{ '--lb-w': `${width}px` }}` on the panel root div. This overrides the `:root` default locally, so both `width: var(--lb-w)` and the closed-state `translateX` transform stay in sync automatically via CSS variable inheritance.

**Drag handle appearance:** `rgba(155,252,150,0.10)` default, `rgba(155,252,150,0.25)` on hover. No visible border — subtle, fits the dark aesthetic. `z-index` above the panel content.

**Name column:** `.lb-name` already has `flex: 1` — it auto-expands as the panel widens. No change needed.

---

## 2. Prominent Search Box

**`web-app/src/index.css`** — `.top-bar-search-pill` section only:

| Property | Before | After |
|----------|--------|-------|
| `background` | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.11)` |
| `border` | `1px solid var(--border)` (11% opacity) | `1px solid rgba(155,252,150,0.22)` (22% opacity) |
| SVG icon opacity | `0.5` | `0.7` |
| `::placeholder` color | `var(--inactive)` (#474845) | `var(--muted)` (#ababa7) |

The focused state already bumps to `--border-active` (35% opacity) — no change needed there.

---

## 3. Scroll Leaderboard to Selected Boundary

**`web-app/src/components/LeaderboardPanel.jsx`**

- Add `listRef = useRef(null)` and attach to the `lb-inner` scroll container
- Add `data-name={row.name}` attribute on each `.lb-list-row` div
- Add `useEffect` watching `selectedFeatureName`:
  - After render, query `listRef.current.querySelector('[data-name="..."]')`
  - If found, call `el.scrollIntoView({ behavior: 'smooth', block: 'center' })`
  - `CSS.escape()` the name to handle any special characters safely
  - If not found (item beyond the 1,000-row display cap), silently no-op

**Timing:** `useEffect` runs after the DOM updates, so the selected card (which pushes rows down) will already be in place before the scroll fires — no extra delay needed.

---

## Out of scope

- Mobile: sheet already shows selected boundary info; no scroll needed (small visible list)
- localStorage persistence of panel width: not wanted, resets each session
- Auto-expanding beyond MAX_ROWS cap when selected item is hidden: deferred
