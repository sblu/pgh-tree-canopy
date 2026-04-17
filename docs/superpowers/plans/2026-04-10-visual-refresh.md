# Living Atlas Visual Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed sidebar with a full-screen map and floating glass panels, implementing the "Living Atlas" dark forest design system.

**Architecture:** Map fills the full viewport (`position: fixed; inset: 0`). All UI lives in `position: fixed` glass panels layered on top. The monolithic `Sidebar.jsx` is replaced by six focused components (`TopBar`, `ControlsPanel`, `LeaderboardPanel`, `LegendPanel`, `MobileChips`, `MobileSheet`). All existing state, hooks, config, and MapLibre rendering logic is preserved unchanged.

**Tech Stack:** React 19, Vite 5, MapLibre GL JS 5 / react-map-gl 8, inline CSS (no Tailwind), Google Fonts (Manrope + Inter).

**Dev server:** `cd web-app && npm run dev` — keep it running. Visual verification is the test suite (no test framework in this project).

---

## File Map

### Create
| File | Responsibility |
|---|---|
| `web-app/src/components/TopBar.jsx` | Frosted top bar: logo, desktop search, share, reset; mobile search icon |
| `web-app/src/components/ControlsPanel.jsx` | Floating right panel: boundary chips, metric radio, overlay toggles |
| `web-app/src/components/LeaderboardPanel.jsx` | Left slide panel: selected boundary stats card + ranked list |
| `web-app/src/components/LegendPanel.jsx` | Bottom-right color-swatch legend |
| `web-app/src/components/MobileChips.jsx` | Fixed top chips row on mobile: boundary/metric pickers + toggle chips |
| `web-app/src/components/MobileSheet.jsx` | Glass bottom sheet (mobile): drag/snap, peek summary, expanded controls |

### Modify
| File | Change |
|---|---|
| `web-app/index.html` | Add Google Fonts link |
| `web-app/src/index.css` | Full rewrite: CSS variables, glass utilities, panel layout rules |
| `web-app/src/App.jsx` | New layout structure, add `leaderboardOpen` state, wire new components, remove Sidebar |
| `web-app/src/components/MapView.jsx` | Remove `NavigationControl` (handled by CSS override of MapLibre controls) |

### Delete (Task 10)
| File | Reason |
|---|---|
| `web-app/src/components/Sidebar.jsx` | Replaced by six focused components |
| `web-app/src/components/Leaderboard.jsx` | Logic absorbed into LeaderboardPanel.jsx |

---

## Task 1: Google Fonts + CSS design system

**Files:**
- Modify: `web-app/index.html`
- Modify: `web-app/src/index.css` (full rewrite)

- [ ] **Step 1: Add Google Fonts to index.html**

Replace the current `<head>` content with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
    <title>Pittsburgh Tree Canopy Explorer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Rewrite index.css**

Replace the entire file content with:

```css
/* ─── Reset ─────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ─── Design tokens ─────────────────────────────────────────────────────── */
:root {
  /* Colors */
  --bg:              #0d0f0c;
  --glass:           rgba(13,15,12,0.82);
  --glass-deep:      rgba(10,12,10,0.90);
  --glass-leaderboard: rgba(11,13,11,0.90);
  --primary:         #9bfc96;
  --primary-dim:     #57b458;
  --secondary:       #ff8f06;
  --text:            #fdfcf7;
  --muted:           #ababa7;
  --inactive:        #474845;
  --border:          rgba(155,252,150,0.11);
  --border-subtle:   rgba(155,252,150,0.07);
  --border-active:   rgba(155,252,150,0.35);
  --border-top-bar:  rgba(155,252,150,0.08);

  /* Layout */
  --top-bar-h:       48px;
  --top-bar-h-mobile: 44px;
  --rail-w:          44px;
  --lb-w:            220px;
  --controls-w:      240px;
  --legend-w:        175px;

  /* Typography */
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  color: var(--text);
}

/* ─── Base ───────────────────────────────────────────────────────────────── */
html, body, #root {
  height: 100%;
  background: var(--bg);
  overflow: hidden;
}

/* ─── App root ───────────────────────────────────────────────────────────── */
.app-root {
  position: fixed;
  inset: 0;
}

/* ─── Glass utility ─────────────────────────────────────────────────────── */
.glass-panel {
  background: var(--glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
}

/* ─── Map container ─────────────────────────────────────────────────────── */
.map-container {
  position: fixed;
  inset: 0;
  z-index: 0;
}

/* ─── Map status overlay ────────────────────────────────────────────────── */
.map-status {
  position: fixed;
  top: calc(var(--top-bar-h) + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: var(--glass-deep);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--muted);
}
.map-status.error { color: var(--secondary); border-color: rgba(255,143,6,0.3); }

/* ─── Public source banner ──────────────────────────────────────────────── */
.public-banner {
  position: fixed;
  top: var(--top-bar-h);
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  background: #2563eb;
  color: #fff;
  padding: 3px 14px;
  border-radius: 0 0 8px 8px;
  font-size: 11px;
  font-weight: 600;
}

/* ─── Top bar ────────────────────────────────────────────────────────────── */
.top-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--top-bar-h);
  background: var(--glass-deep);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--border-top-bar);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 12px;
  z-index: 100;
}

.top-bar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  text-decoration: none;
}
.top-bar-logo {
  height: 30px;
  width: auto;
  object-fit: contain;
  flex-shrink: 0;
}
.top-bar-titles { display: flex; flex-direction: column; line-height: 1.2; }
.top-bar-title {
  font-family: Manrope, sans-serif;
  font-size: 13px;
  font-weight: 800;
  color: var(--primary);
}
.top-bar-subtitle { font-size: 10px; color: var(--muted); }

/* Desktop search pill */
.top-bar-search-wrap {
  flex: 1;
  max-width: 380px;
  margin: 0 auto;
  position: relative;
}
.top-bar-search-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 12px;
  transition: border-color 0.15s;
}
.top-bar-search-pill.focused { border-color: var(--border-active); }
.top-bar-search-pill svg { flex-shrink: 0; opacity: 0.5; }
.top-bar-search-pill input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--text);
  font-family: Inter, sans-serif;
}
.top-bar-search-pill input::placeholder { color: var(--inactive); }
.search-selected-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--primary);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  font-family: Inter, sans-serif;
}
.search-selected-chip:hover { opacity: 0.8; }

.top-bar-search-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  background: var(--glass-deep);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  max-height: 280px;
  overflow-y: auto;
  z-index: 200;
  scrollbar-width: thin;
  scrollbar-color: var(--inactive) transparent;
}
.search-result {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
}
.search-result:hover { background: rgba(155,252,150,0.07); color: var(--text); }

.top-bar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.top-bar-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.top-bar-icon-btn:hover { color: var(--text); background: rgba(155,252,150,0.07); }
.top-bar-icon-btn.active { color: var(--primary); }

/* ─── Left icon rail ────────────────────────────────────────────────────── */
.left-rail {
  position: fixed;
  top: var(--top-bar-h);
  left: 0;
  bottom: 0;
  width: var(--rail-w);
  background: rgba(10,12,10,0.78);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  gap: 4px;
  z-index: 90;
}
.rail-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--inactive);
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.15s, background 0.15s;
}
.rail-icon:hover { color: var(--muted); }
.rail-icon--active { background: rgba(155,252,150,0.14) !important; color: var(--primary) !important; }
.rail-icon:disabled { opacity: 0.3; cursor: not-allowed; }
.rail-divider { width: 22px; height: 1px; background: var(--border-subtle); margin: 4px 0; }

/* ─── Leaderboard panel ─────────────────────────────────────────────────── */
.leaderboard-panel {
  position: fixed;
  top: var(--top-bar-h);
  left: var(--rail-w);
  bottom: 0;
  width: var(--lb-w);
  background: var(--glass-leaderboard);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-right: 1px solid var(--border-subtle);
  z-index: 80;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.25s ease;
}
.leaderboard-panel--closed {
  transform: translateX(calc(-1 * (var(--rail-w) + var(--lb-w))));
}

.lb-inner {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--inactive) transparent;
}
.lb-panel-title {
  font-family: Manrope, sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.lb-sort-btn {
  background: none;
  border: none;
  font-size: 10px;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  font-family: Inter, sans-serif;
}
.lb-sort-btn:hover { color: var(--text); }

/* Selected boundary card */
.lb-selected-card {
  background: rgba(155,252,150,0.07);
  border: 1px solid rgba(155,252,150,0.22);
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 12px;
}
.lb-selected-name {
  font-family: Manrope, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.lb-selected-sub { font-size: 9px; color: var(--muted); margin-bottom: 8px; }
.lb-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.lb-stat {
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 6px 8px;
}
.lb-stat-val {
  font-family: Manrope, sans-serif;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
}
.lb-stat-val--green { color: var(--primary); }
.lb-stat-val--amber { color: var(--secondary); }
.lb-stat-val--neutral { color: var(--text); }
.lb-stat-lbl {
  font-size: 8px;
  color: var(--inactive);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 3px;
}
.lb-dismiss-btn {
  background: none;
  border: none;
  color: var(--inactive);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 2px;
  flex-shrink: 0;
}
.lb-dismiss-btn:hover { color: var(--muted); }

/* Ranked list */
.lb-sep { height: 1px; background: var(--border-subtle); margin: 8px 0; }
.lb-list-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s;
}
.lb-list-row:hover { background: rgba(155,252,150,0.06); }
.lb-list-row--selected { background: rgba(155,252,150,0.09); }
.lb-rank { font-size: 9px; color: var(--inactive); width: 14px; text-align: right; flex-shrink: 0; }
.lb-name { font-size: 10px; color: var(--muted); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lb-name--selected { color: var(--text); font-weight: 500; }
.lb-bar-wrap { width: 40px; flex-shrink: 0; }
.lb-bar-bg { height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; }
.lb-bar { height: 3px; border-radius: 2px; background: var(--primary); }
.lb-bar--loss { background: var(--secondary); }
.lb-val { font-size: 9px; color: var(--primary); width: 36px; text-align: right; flex-shrink: 0; }
.lb-val--loss { color: var(--secondary); }
.lb-empty { font-size: 11px; color: var(--muted); padding: 20px 0; text-align: center; line-height: 1.5; }

/* ─── Controls panel ────────────────────────────────────────────────────── */
.controls-panel {
  position: fixed;
  top: 60px;
  right: 12px;
  width: var(--controls-w);
  background: var(--glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 20px;
  z-index: 80;
  overflow: hidden;
}
.controls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 0;
}
.controls-title {
  font-family: Manrope, sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.controls-chevron {
  background: none;
  border: none;
  color: var(--inactive);
  cursor: pointer;
  font-size: 13px;
  transition: transform 0.2s;
  line-height: 1;
}
.controls-chevron--open { transform: rotate(180deg); }
.controls-body { padding: 10px 14px 14px; }

.cp-section { margin-bottom: 12px; }
.cp-section:last-child { margin-bottom: 0; }
.cp-sep { height: 1px; background: var(--border-subtle); margin: 10px 0; }
.cp-label {
  font-size: 9px;
  font-weight: 600;
  color: var(--inactive);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 7px;
}
.cp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.cp-chip {
  font-size: 10px;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s;
  font-family: Inter, sans-serif;
}
.cp-chip:hover { color: var(--text); }
.cp-chip--active {
  background: rgba(155,252,150,0.14);
  border-color: var(--border-active);
  color: var(--primary);
  font-weight: 600;
}
.cp-radio { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; cursor: pointer; }
.cp-radio-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  border: 2px solid var(--inactive);
  flex-shrink: 0;
  margin-top: 2px;
  transition: all 0.15s;
}
.cp-radio-dot--active {
  border-color: var(--primary);
  background: var(--primary);
  box-shadow: 0 0 6px rgba(155,252,150,0.4);
}
.cp-radio-label { font-size: 10px; color: var(--muted); line-height: 1.4; }
.cp-radio-label--active { color: var(--text); }

.cp-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  cursor: pointer;
}
.cp-toggle-label { font-size: 10px; color: var(--muted); }
.cp-toggle-label--active { color: var(--text); }
.cp-toggle {
  width: 30px; height: 16px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  position: relative;
  flex-shrink: 0;
  transition: all 0.15s;
}
.cp-toggle--on {
  background: rgba(155,252,150,0.2);
  border-color: rgba(155,252,150,0.35);
}
.cp-toggle-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 12px; height: 12px;
  border-radius: 50%;
  background: var(--inactive);
  transition: transform 0.15s, background 0.15s;
}
.cp-toggle--on .cp-toggle-knob {
  transform: translateX(14px);
  background: var(--primary);
}

/* ─── Legend panel ──────────────────────────────────────────────────────── */
.legend-panel {
  position: fixed;
  bottom: 16px;
  right: 12px;
  width: var(--legend-w);
  background: var(--glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px;
  z-index: 80;
}
.legend-title {
  font-size: 9px;
  font-weight: 600;
  color: var(--inactive);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}
.legend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
.legend-row:last-child { margin-bottom: 0; }
.legend-swatch { width: 20px; height: 7px; border-radius: 3px; flex-shrink: 0; }
.legend-label { font-size: 9px; color: var(--muted); }

/* ─── Zoom controls (MapLibre override) ─────────────────────────────────── */
.maplibregl-ctrl-bottom-left { bottom: 16px !important; left: calc(var(--rail-w) + var(--lb-w) + 12px) !important; }
.maplibregl-ctrl-group {
  background: var(--glass) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border: 1px solid var(--border) !important;
  border-radius: 999px !important;
  box-shadow: none !important;
  overflow: hidden;
}
.maplibregl-ctrl-group button {
  background: transparent !important;
  color: var(--muted) !important;
  border: none !important;
  width: 34px !important;
  height: 30px !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.maplibregl-ctrl-group button:hover { color: var(--text) !important; background: rgba(155,252,150,0.06) !important; }
.maplibregl-ctrl-group button + button { border-top: 1px solid var(--border-subtle) !important; }
.maplibregl-ctrl-group .maplibregl-ctrl-icon { filter: invert(0.6); }

/* ─── MapLibre popup (hover) ────────────────────────────────────────────── */
.maplibregl-popup-content {
  background: var(--glass-deep) !important;
  backdrop-filter: blur(20px) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  padding: 12px !important;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
  color: var(--text) !important;
  font-family: Inter, sans-serif !important;
  font-size: 12px !important;
}
.maplibregl-popup-tip { display: none !important; }
.maplibregl-popup-close-button { color: var(--muted) !important; font-size: 16px !important; }

/* InfoPanel inside popup */
.info-panel-name {
  font-family: Manrope, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}
.info-table { width: 100%; border-collapse: collapse; }
.info-table td { padding: 2px 0; font-size: 11px; }
.info-table td:first-child { color: var(--muted); padding-right: 10px; }
.info-table td:last-child { color: var(--text); text-align: right; }
.info-table .section-header td { color: var(--primary); font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; padding-top: 7px; }
.info-table .positive { color: var(--primary) !important; }
.info-table .negative { color: var(--secondary) !important; }
.info-table .highlight { color: var(--primary) !important; font-weight: 600; }
.info-table .muted { color: var(--inactive); }

/* ─── Mobile: chips row ─────────────────────────────────────────────────── */
.mobile-chips-row {
  position: fixed;
  top: var(--top-bar-h-mobile);
  left: 0; right: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  overflow-x: auto;
  scrollbar-width: none;
}
.mobile-chips-row::-webkit-scrollbar { display: none; }
.mobile-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--glass-deep);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  font-family: Inter, sans-serif;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.mobile-chip--active-green {
  color: var(--primary);
  border-color: rgba(155,252,150,0.35);
  background: rgba(13,15,12,0.88);
}
.mobile-chip--active-amber {
  color: var(--secondary);
  border-color: rgba(255,143,6,0.35);
  background: rgba(13,15,12,0.88);
}

/* chip dropdown */
.chip-dropdown {
  position: fixed;
  top: calc(var(--top-bar-h-mobile) + 46px);
  left: 12px;
  min-width: 200px;
  background: var(--glass-deep);
  backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 14px;
  z-index: 200;
  overflow: hidden;
}
.chip-dropdown-item {
  padding: 10px 14px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.1s;
}
.chip-dropdown-item:hover { background: rgba(155,252,150,0.07); color: var(--text); }
.chip-dropdown-item--active { color: var(--primary); font-weight: 600; }

/* ─── Mobile: bottom sheet ──────────────────────────────────────────────── */
.mobile-sheet {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 85;
  background: var(--glass-deep);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 20px 20px 0 0;
  border-top: 1px solid rgba(155,252,150,0.14);
  overflow: hidden;
  transition: max-height 0.3s ease;
  max-height: 90px; /* peek */
}
.mobile-sheet[data-state="expanded"] { max-height: 90vh; }
.mobile-sheet[data-state="full"]     { max-height: 100vh; border-radius: 0; }

.mobile-sheet-scroll {
  overflow-y: auto;
  height: 100%;
  scrollbar-width: thin;
  scrollbar-color: var(--inactive) transparent;
}
.sheet-drag-handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 6px;
  cursor: grab;
  flex-shrink: 0;
}
.sheet-drag-handle-bar {
  width: 36px; height: 4px;
  border-radius: 2px;
  background: var(--inactive);
}
.sheet-peek-summary {
  padding: 0 16px 12px;
  font-size: 12px;
  color: var(--muted);
}
.sheet-peek-name { font-family: Manrope, sans-serif; font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
.sheet-peek-stat { font-size: 11px; }
.sheet-peek-stat--green { color: var(--primary); }
.sheet-peek-stat--amber { color: var(--secondary); }

.sheet-expanded-content { padding: 0 14px 24px; }

.sheet-search-wrap { margin-bottom: 14px; }
.sheet-search-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0 12px;
}
.sheet-search-pill input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--text);
  font-family: Inter, sans-serif;
}
.sheet-search-pill input::placeholder { color: var(--inactive); }
.sheet-search-results {
  background: rgba(13,15,12,0.95);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-top: 4px;
  max-height: 180px;
  overflow-y: auto;
}
.sheet-search-results .search-result { font-size: 13px; }

/* ─── Shared panel heading ──────────────────────────────────────────────── */
.panel-section-heading {
  font-family: Manrope, sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 14px 0 8px;
}

/* ─── MapLibre map fills container ─────────────────────────────────────── */
.maplibregl-map { width: 100% !important; height: 100% !important; }
```

- [ ] **Step 3: Verify foundation**

Open the dev server (already running at `https://localhost:5173`). The page should show the map filling the viewport with a dark flash behind it. The Sidebar is still rendered by App.jsx and will appear in its old fixed position — that's fine for now, it will be replaced in Task 8.

- [ ] **Step 4: Commit**

```bash
cd /home/scott/Desktop/TreesGIS-ClaudeCode
git add web-app/index.html web-app/src/index.css
git commit -m "Add Living Atlas CSS design system and Google Fonts"
```

---

## Task 2: TopBar component

**Files:**
- Create: `web-app/src/components/TopBar.jsx`

- [ ] **Step 1: Create TopBar.jsx**

```jsx
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

      {/* Mobile: search icon opens bottom sheet */}
      {isMobile && (
        <button className="top-bar-icon-btn" onClick={onMobileSearch} title="Search" style={{ marginLeft: 'auto' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
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
```

- [ ] **Step 2: Verify (after Task 8 wires it — skip verification here)**

TopBar will be verified when App.jsx is restructured in Task 8.

- [ ] **Step 3: Commit**

```bash
git add web-app/src/components/TopBar.jsx
git commit -m "Add TopBar component: logo, desktop search, share, reset"
```

---

## Task 3: LegendPanel component

**Files:**
- Create: `web-app/src/components/LegendPanel.jsx`

- [ ] **Step 1: Create LegendPanel.jsx**

```jsx
import { useMemo } from 'react'
import { CHOROPLETH_COLORS, COVERAGE_COLORS, COLOR_METHODS } from '../config/layers'

export default function LegendPanel({ colorBreaks, activeMethodId, isCoverage }) {
  const method = COLOR_METHODS.find(m => m.id === activeMethodId)

  const steps = useMemo(() => {
    if (!colorBreaks.length) return []
    const colors = isCoverage ? COVERAGE_COLORS : CHOROPLETH_COLORS
    const fmt = isCoverage
      ? v => `${Number(v).toFixed(1)}`
      : v => { const n = Number(v).toFixed(1); return Number(v) >= 0 ? `+${n}` : `${n}` }
    const result = []
    result.push({ color: colors[0], label: `< ${fmt(colorBreaks[0])}%` })
    colorBreaks.forEach((b, i) => {
      const next = colorBreaks[i + 1]
      const color = colors[i + 1] ?? colors[colors.length - 1]
      result.push({ color, label: next ? `${fmt(b)} to ${fmt(next)}%` : `> ${fmt(b)}%` })
    })
    return result
  }, [colorBreaks, isCoverage])

  if (!steps.length) return null

  return (
    <div className="legend-panel">
      <div className="legend-title">{method?.label ?? 'Legend'}</div>
      {steps.map((s, i) => (
        <div key={i} className="legend-row">
          <div className="legend-swatch" style={{ background: s.color }} />
          <span className="legend-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/components/LegendPanel.jsx
git commit -m "Add LegendPanel component: glass color-swatch legend"
```

---

## Task 4: ControlsPanel component

**Files:**
- Create: `web-app/src/components/ControlsPanel.jsx`

- [ ] **Step 1: Create ControlsPanel.jsx**

```jsx
import { useState } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS } from '../config/layers'

// Short labels for the boundary layer chips
const CHIP_LABELS = {
  neighborhoods:   'Hoods',
  city_council:    'City Council',
  county_council:  'County Council',
  parks_municipal: 'City Parks',
  parks_county:    'County Parks',
  municipalities:  'Municipalities',
  streets:         'Streets',
}

export default function ControlsPanel({
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
}) {
  const [collapsed, setCollapsed] = useState(false)

  const visibleLayers = BOUNDARY_LAYERS.filter(l => l.id !== 'none')

  return (
    <div className="controls-panel">
      <div className="controls-header">
        <div className="controls-title">Controls</div>
        <button
          className={`controls-chevron${collapsed ? '' : ' controls-chevron--open'}`}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand controls' : 'Collapse controls'}
        >
          ▾
        </button>
      </div>

      {!collapsed && (
        <div className="controls-body">
          {/* View By */}
          <div className="cp-section">
            <div className="cp-label">View By</div>
            <div className="cp-chips">
              {visibleLayers.map(l => (
                <button
                  key={l.id}
                  className={`cp-chip${activeBoundaryLayerId === l.id ? ' cp-chip--active' : ''}`}
                  onClick={() => onBoundaryLayerChange(l.id)}
                >
                  {CHIP_LABELS[l.id] ?? l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cp-sep" />

          {/* Color By */}
          <div className="cp-section">
            <div className="cp-label">Color By</div>
            {COLOR_METHODS.map(m => (
              <label key={m.id} className="cp-radio" onClick={() => onMethodChange(m.id)}>
                <div className={`cp-radio-dot${activeMethodId === m.id ? ' cp-radio-dot--active' : ''}`} />
                <span className={`cp-radio-label${activeMethodId === m.id ? ' cp-radio-label--active' : ''}`}>
                  {m.label}
                </span>
              </label>
            ))}
          </div>

          <div className="cp-sep" />

          {/* Overlays */}
          <div className="cp-section">
            <div className="cp-label">Overlays</div>
            {[
              { label: 'Tree Losses',        value: showTreeLosses,   onChange: onShowTreeLossesChange },
              { label: 'Tree Gains',         value: showTreeGains,    onChange: onShowTreeGainsChange },
              { label: 'Street Buffer Zone', value: showStreetBuffer, onChange: onShowStreetBufferChange },
              { label: 'Full Canopy Layer',  value: showCanopyChange, onChange: onShowCanopyChangeChange },
            ].map(({ label, value, onChange }) => (
              <div key={label} className="cp-toggle-row" onClick={() => onChange(!value)}>
                <span className={`cp-toggle-label${value ? ' cp-toggle-label--active' : ''}`}>{label}</span>
                <div className={`cp-toggle${value ? ' cp-toggle--on' : ''}`}>
                  <div className="cp-toggle-knob" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/components/ControlsPanel.jsx
git commit -m "Add ControlsPanel component: boundary chips, metric radio, overlay toggles"
```

---

## Task 5: LeaderboardPanel component

**Files:**
- Create: `web-app/src/components/LeaderboardPanel.jsx`

This component absorbs the `computeCentroid` helper and ranked-list logic from the old `Leaderboard.jsx`, and adds the selected-boundary stats card.

- [ ] **Step 1: Create LeaderboardPanel.jsx**

```jsx
import { useMemo, useState } from 'react'
import { COLOR_METHODS } from '../config/layers'

function computeCentroid(geometry) {
  let sumLng = 0, sumLat = 0, count = 0
  const walk = coords => {
    if (typeof coords[0] === 'number') { sumLng += coords[0]; sumLat += coords[1]; count++ }
    else coords.forEach(walk)
  }
  walk(geometry.coordinates)
  return count > 0 ? { lng: sumLng / count, lat: sumLat / count } : { lng: 0, lat: 0 }
}

function fmtAcres(v) {
  if (v == null) return '—'
  return `${Math.abs(Number(v)).toLocaleString(undefined, { maximumFractionDigits: 1 })} ac`
}

function fmtPct(v, isCoverage) {
  if (v == null) return '—'
  const n = Number(v)
  if (isCoverage) return `${n.toFixed(1)}%`
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

export default function LeaderboardPanel({
  isOpen,           // boolean — controlled by left-rail icon in App.jsx
  layerData,        // GeoJSON FeatureCollection | null
  activeMethodId,   // string
  selectedFeatureName, // string | null
  onFeatureSelect,  // (name: string | null) => void
  onHover,          // ({ feature, lngLat }) => void
  onHoverEnd,       // () => void
}) {
  const [sortAsc, setSortAsc] = useState(false)

  const method    = COLOR_METHODS.find(m => m.id === activeMethodId)
  const isCoverage = method?.group === 'coverage'

  const ranked = useMemo(() => {
    if (!layerData?.features) return []
    return layerData.features
      .map(f => ({ name: f.properties?.name, value: f.properties?.[activeMethodId], feature: f }))
      .filter(r => r.name && r.value != null)
      .sort((a, b) => sortAsc ? a.value - b.value : b.value - a.value)
  }, [layerData, activeMethodId, sortAsc])

  const maxAbs = useMemo(() => Math.max(...ranked.map(r => Math.abs(r.value)), 0.001), [ranked])

  const selectedFeature = useMemo(() => {
    if (!selectedFeatureName || !layerData?.features) return null
    return layerData.features.find(f => f.properties?.name === selectedFeatureName) ?? null
  }, [selectedFeatureName, layerData])

  function handleRowEnter(row) {
    const lngLat = computeCentroid(row.feature.geometry)
    onHover({ feature: row.feature, lngLat })
  }

  const p = selectedFeature?.properties
  const netVal = p ? (p[activeMethodId] ?? null) : null
  const isLoss = netVal != null && !isCoverage && netVal < 0

  return (
    <div className={`leaderboard-panel${isOpen ? '' : ' leaderboard-panel--closed'}`}>
      <div className="lb-inner">
        <div className="lb-panel-title">
          {method?.label ?? 'Leaderboard'}
          <button className="lb-sort-btn" onClick={() => setSortAsc(a => !a)}>
            {sortAsc ? '↑ Lowest' : '↓ Highest'}
          </button>
        </div>

        {/* Selected boundary card */}
        {selectedFeature && p && (
          <div className="lb-selected-card">
            <div className="lb-selected-name">
              {p.name}
              <button className="lb-dismiss-btn" onClick={() => onFeatureSelect(null)}>✕</button>
            </div>
            <div className="lb-selected-sub">
              {p.land_area_acres != null ? `${p.land_area_acres.toFixed(0)} acres` : ''}
            </div>
            <div className="lb-stat-grid">
              <div className="lb-stat">
                <div className={`lb-stat-val ${isLoss ? 'lb-stat-val--amber' : isCoverage ? 'lb-stat-val--neutral' : 'lb-stat-val--green'}`}>
                  {fmtPct(netVal, isCoverage)}
                </div>
                <div className="lb-stat-lbl">
                  {isCoverage ? '2020 Canopy' : 'Net Change'}
                </div>
              </div>
              <div className="lb-stat">
                <div className="lb-stat-val lb-stat-val--neutral">
                  {p.canopy_2020_acres != null && p.land_area_acres > 0
                    ? `${(p.canopy_2020_acres / p.land_area_acres * 100).toFixed(1)}%`
                    : '—'}
                </div>
                <div className="lb-stat-lbl">2020 Coverage</div>
              </div>
              <div className="lb-stat">
                <div className="lb-stat-val lb-stat-val--green">{fmtAcres(p.gain_acres)}</div>
                <div className="lb-stat-lbl">Gained</div>
              </div>
              <div className="lb-stat">
                <div className="lb-stat-val lb-stat-val--amber">{fmtAcres(p.loss_acres)}</div>
                <div className="lb-stat-lbl">Lost</div>
              </div>
            </div>
          </div>
        )}

        {/* Ranked list */}
        {ranked.length === 0 && (
          <div className="lb-empty">Click a zone on the map<br/>to explore its canopy data</div>
        )}
        {ranked.length > 0 && (
          <>
            {ranked.map((row, i) => {
              const barPct = (Math.abs(row.value) / maxAbs) * 100
              const isNeg  = !isCoverage && row.value < 0
              const isSel  = row.name === selectedFeatureName
              return (
                <div
                  key={row.name}
                  className={`lb-list-row${isSel ? ' lb-list-row--selected' : ''}`}
                  onMouseEnter={() => handleRowEnter(row)}
                  onMouseLeave={onHoverEnd}
                  onClick={() => onFeatureSelect(row.name)}
                >
                  <span className="lb-rank">{i + 1}</span>
                  <span className={`lb-name${isSel ? ' lb-name--selected' : ''}`}>{row.name}</span>
                  <div className="lb-bar-wrap">
                    <div className="lb-bar-bg">
                      <div className={`lb-bar${isNeg ? ' lb-bar--loss' : ''}`} style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <span className={`lb-val${isNeg ? ' lb-val--loss' : ''}`}>
                    {fmtPct(row.value, isCoverage)}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/components/LeaderboardPanel.jsx
git commit -m "Add LeaderboardPanel: selected boundary stats card + ranked list"
```

---

## Task 6: MobileChips component

**Files:**
- Create: `web-app/src/components/MobileChips.jsx`

- [ ] **Step 1: Create MobileChips.jsx**

```jsx
import { useState } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS } from '../config/layers'

const CHIP_LABELS = {
  neighborhoods:   'Neighborhoods',
  city_council:    'City Council',
  county_council:  'County Council',
  parks_municipal: 'City Parks',
  parks_county:    'County Parks',
  municipalities:  'Municipalities',
  streets:         'Streets',
}

const METHOD_SHORT = {
  canopy_2020_pct:        '2020 Canopy',
  net_pct_of_area:        'Net / Area',
  net_pct_of_2015_canopy: 'Net / 2015',
}

export default function MobileChips({
  activeBoundaryLayerId,
  onBoundaryLayerChange,
  activeMethodId,
  onMethodChange,
  showTreeLosses,
  onShowTreeLossesChange,
  showTreeGains,
  onShowTreeGainsChange,
}) {
  const [openDropdown, setOpenDropdown] = useState(null) // 'boundary' | 'metric' | null

  function toggleDropdown(name) {
    setOpenDropdown(d => d === name ? null : name)
  }

  function selectBoundary(id) {
    onBoundaryLayerChange(id)
    setOpenDropdown(null)
  }

  function selectMethod(id) {
    onMethodChange(id)
    setOpenDropdown(null)
  }

  const visibleLayers = BOUNDARY_LAYERS.filter(l => l.id !== 'none')
  const activeLayerLabel = CHIP_LABELS[activeBoundaryLayerId] ?? activeBoundaryLayerId
  const activeMethodShort = METHOD_SHORT[activeMethodId] ?? activeMethodId

  return (
    <>
      <div className="mobile-chips-row">
        {/* Boundary picker chip */}
        <button
          className={`mobile-chip${openDropdown === 'boundary' ? ' mobile-chip--active-green' : ''}`}
          onClick={() => toggleDropdown('boundary')}
        >
          {activeLayerLabel} ▾
        </button>

        {/* Metric picker chip */}
        <button
          className={`mobile-chip${openDropdown === 'metric' ? ' mobile-chip--active-green' : ''}`}
          onClick={() => toggleDropdown('metric')}
        >
          {activeMethodShort} ▾
        </button>

        {/* Losses toggle chip */}
        <button
          className={`mobile-chip${showTreeLosses ? ' mobile-chip--active-amber' : ''}`}
          onClick={() => onShowTreeLossesChange(!showTreeLosses)}
        >
          {showTreeLosses ? '● ' : '○ '}Losses
        </button>

        {/* Gains toggle chip */}
        <button
          className={`mobile-chip${showTreeGains ? ' mobile-chip--active-green' : ''}`}
          onClick={() => onShowTreeGainsChange(!showTreeGains)}
        >
          {showTreeGains ? '● ' : '○ '}Gains
        </button>
      </div>

      {/* Boundary dropdown */}
      {openDropdown === 'boundary' && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setOpenDropdown(null)}
          />
          <div className="chip-dropdown">
            {visibleLayers.map(l => (
              <div
                key={l.id}
                className={`chip-dropdown-item${activeBoundaryLayerId === l.id ? ' chip-dropdown-item--active' : ''}`}
                onClick={() => selectBoundary(l.id)}
              >
                {l.label}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Metric dropdown */}
      {openDropdown === 'metric' && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setOpenDropdown(null)}
          />
          <div className="chip-dropdown" style={{ left: '130px' }}>
            {COLOR_METHODS.map(m => (
              <div
                key={m.id}
                className={`chip-dropdown-item${activeMethodId === m.id ? ' chip-dropdown-item--active' : ''}`}
                onClick={() => selectMethod(m.id)}
              >
                {m.label}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web-app/src/components/MobileChips.jsx
git commit -m "Add MobileChips component: boundary/metric picker chips + toggle chips"
```

---

## Task 7: MobileSheet component

**Files:**
- Create: `web-app/src/components/MobileSheet.jsx`

This component absorbs the touch drag/snap logic currently in `App.jsx` (lines 263–330).

- [ ] **Step 1: Create MobileSheet.jsx**

```jsx
import { useEffect, useRef, useState, useMemo } from 'react'
import { BOUNDARY_LAYERS, COLOR_METHODS } from '../config/layers'
import ControlsPanel from './ControlsPanel'
import LeaderboardPanel from './LeaderboardPanel'

export default function MobileSheet({
  sheetState,
  onSheetStateChange,
  // Selected boundary summary (peek content)
  selectedFeatureName,
  layerData,
  activeMethodId,
  isCoverage,
  // Search
  activeLayer,
  onFeatureSelect,
  // ControlsPanel props
  activeBoundaryLayerId,
  onBoundaryLayerChange,
  onMethodChange,
  showTreeLosses,
  onShowTreeLossesChange,
  showTreeGains,
  onShowTreeGainsChange,
  showStreetBuffer,
  onShowStreetBufferChange,
  showCanopyChange,
  onShowCanopyChangeChange,
  // Leaderboard
  onHover,
  onHoverEnd,
  // Legend
  colorBreaks,
}) {
  const wrapperRef = useRef(null)
  const searchRef  = useRef(null)
  const dragStartY      = useRef(0)
  const dragStartHeight = useRef(0)
  const isDragging      = useRef(false)

  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)

  // Auto-focus search when sheet expands
  useEffect(() => {
    if (sheetState === 'expanded') {
      setTimeout(() => searchRef.current?.focus(), 300)
    }
  }, [sheetState])

  // Touch drag/snap (identical logic from App.jsx)
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handle = wrapper.querySelector('.sheet-drag-handle')
    if (!handle) return

    const onTouchStart = e => {
      if (e.target.closest('button, a, input')) return
      dragStartY.current      = e.touches[0].clientY
      dragStartHeight.current = wrapper.getBoundingClientRect().height
      isDragging.current      = false
      wrapper.style.transition = 'none'
    }
    const onTouchMove = e => {
      const deltaY = dragStartY.current - e.touches[0].clientY
      if (Math.abs(deltaY) > 10) isDragging.current = true
      const newH = Math.max(60, Math.min(window.innerHeight * 0.95, dragStartHeight.current + deltaY))
      wrapper.style.maxHeight = `${newH}px`
    }
    const onTouchEnd = e => {
      if (e.target.closest('button, a, input')) return
      wrapper.style.transition = ''
      wrapper.style.maxHeight  = ''
      if (!isDragging.current) {
        onSheetStateChange(s => s === 'peek' ? 'expanded' : 'peek')
        return
      }
      const finalH = wrapper.getBoundingClientRect().height
      const vh = window.innerHeight
      if      (finalH < vh * 0.15) onSheetStateChange('peek')
      else if (finalH < vh * 0.70) onSheetStateChange('expanded')
      else                          onSheetStateChange('full')
    }

    handle.addEventListener('touchstart', onTouchStart, { passive: true })
    handle.addEventListener('touchmove',  onTouchMove,  { passive: true })
    handle.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      handle.removeEventListener('touchstart', onTouchStart)
      handle.removeEventListener('touchmove',  onTouchMove)
      handle.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onSheetStateChange])

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

  const method    = COLOR_METHODS.find(m => m.id === activeMethodId)
  const selFeature = layerData?.features?.find(f => f.properties?.name === selectedFeatureName)
  const selVal    = selFeature?.properties?.[activeMethodId]
  const selIsLoss = selVal != null && !isCoverage && selVal < 0

  function fmtVal(v) {
    if (v == null) return null
    const n = Number(v)
    if (isCoverage) return `${n.toFixed(1)}%`
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
  }

  function handleSearchSelect(name) {
    onFeatureSelect(name)
    setQuery('')
    setFocused(false)
  }

  const showResults = focused && filtered.length > 0 && !selectedFeatureName

  return (
    <div className="mobile-sheet" data-state={sheetState} ref={wrapperRef}>
      <div className="sheet-drag-handle">
        <div className="sheet-drag-handle-bar" />
      </div>

      {/* Peek content: summary of selected boundary (or CTA) */}
      <div className="sheet-peek-summary">
        {selectedFeatureName && selFeature ? (
          <>
            <div className="sheet-peek-name">{selectedFeatureName}</div>
            <span className={`sheet-peek-stat ${selIsLoss ? 'sheet-peek-stat--amber' : 'sheet-peek-stat--green'}`}>
              {fmtVal(selVal)}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: '11px' }}> · {method?.label}</span>
          </>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Tap a zone on the map to explore · swipe up for controls
          </span>
        )}
      </div>

      {/* Expanded content */}
      {sheetState !== 'peek' && (
        <div className="sheet-expanded-content">
          {/* Search */}
          <div className="sheet-search-wrap">
            <div className="sheet-search-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
              </svg>
              {selectedFeatureName ? (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => { onFeatureSelect(null); setQuery('') }}
                >
                  {selectedFeatureName} <span style={{ opacity: 0.6 }}>✕</span>
                </button>
              ) : (
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)}
                  placeholder={activeLayer?.searchPlaceholder || 'Search…'}
                />
              )}
            </div>
            {showResults && (
              <div className="sheet-search-results">
                {filtered.map(name => (
                  <div key={name} className="search-result" onMouseDown={() => handleSearchSelect(name)}>
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls (reuse ControlsPanel in inline mode) */}
          <div className="panel-section-heading">Controls</div>
          <ControlsPanel
            activeBoundaryLayerId={activeBoundaryLayerId}
            onBoundaryLayerChange={onBoundaryLayerChange}
            activeMethodId={activeMethodId}
            onMethodChange={onMethodChange}
            showTreeLosses={showTreeLosses}
            onShowTreeLossesChange={onShowTreeLossesChange}
            showTreeGains={showTreeGains}
            onShowTreeGainsChange={onShowTreeGainsChange}
            showStreetBuffer={showStreetBuffer}
            onShowStreetBufferChange={onShowStreetBufferChange}
            showCanopyChange={showCanopyChange}
            onShowCanopyChangeChange={onShowCanopyChangeChange}
          />

          {/* Leaderboard (reuse LeaderboardPanel in inline mode) */}
          <div className="panel-section-heading" style={{ marginTop: '18px' }}>Rankings</div>
          <LeaderboardPanel
            isOpen={true}
            layerData={layerData}
            activeMethodId={activeMethodId}
            selectedFeatureName={selectedFeatureName}
            onFeatureSelect={onFeatureSelect}
            onHover={onHover}
            onHoverEnd={onHoverEnd}
          />
        </div>
      )}
    </div>
  )
}
```

> **Note:** `ControlsPanel` and `LeaderboardPanel` are rendered inside `MobileSheet` in "inline" mode. For `ControlsPanel`, this means it renders with its glass card styling but inside the sheet. Override the panel card styles for the inline context in CSS if needed (Task 1 CSS already removed the fixed positioning — the components use class-based styling so they render inline naturally).
>
> **CSS adjustment needed:** The `.controls-panel` CSS uses `position: fixed`. When rendered inside `MobileSheet`, the fixed positioning breaks. Add an `.controls-panel--inline` modifier in `index.css`:
>
> ```css
> .controls-panel--inline {
>   position: static;
>   width: 100%;
>   border-radius: 12px;
> }
> ```
>
> Pass `inline` prop to `ControlsPanel` and apply the modifier class.

- [ ] **Step 2: Add inline mode to ControlsPanel**

In `web-app/src/components/ControlsPanel.jsx`, add an `inline` prop:

```jsx
export default function ControlsPanel({
  // ... existing props ...
  inline = false,   // add this
}) {
  // ...
  return (
    <div className={`controls-panel${inline ? ' controls-panel--inline' : ''}`}>
```

Add to `index.css` (append to the `.controls-panel` block):

```css
.controls-panel--inline {
  position: static;
  width: 100%;
  border-radius: 12px;
}
```

Update `MobileSheet.jsx` to pass `inline` to `ControlsPanel`:

```jsx
<ControlsPanel
  inline
  activeBoundaryLayerId={activeBoundaryLayerId}
  // ... rest of props unchanged ...
/>
```

- [ ] **Step 3: Commit**

```bash
git add web-app/src/components/MobileSheet.jsx web-app/src/components/ControlsPanel.jsx web-app/src/index.css
git commit -m "Add MobileSheet component: glass bottom sheet with drag/snap and inline controls"
```

---

## Task 8: App.jsx cutover — new layout, wire all components

**Files:**
- Modify: `web-app/src/App.jsx`
- Modify: `web-app/src/components/MapView.jsx` (remove NavigationControl positioning — let CSS handle it)

This is the task that makes the new UI visible. After this task the old `Sidebar` is gone and all new components are live.

- [ ] **Step 1: Update App.jsx imports**

Replace the import block at the top of `App.jsx`. Remove the `Sidebar` import and add the new components:

```jsx
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { BOUNDARY_LAYERS, STREET_BUFFER_PATH, COLOR_METHODS, CHOROPLETH_COLORS, COVERAGE_COLORS, LOCAL_STORAGE_KEY } from './config/layers'
import { DATA_PREFIX, SOURCE_LABEL, IS_PUBLIC_SOURCE } from './config/dataSource'
import { useLayerData, computeQuantileBreaks } from './hooks/useLayerData'
import { useUrlHash } from './hooks/useUrlHash'
import TopBar          from './components/TopBar'
import ControlsPanel   from './components/ControlsPanel'
import LeaderboardPanel from './components/LeaderboardPanel'
import LegendPanel     from './components/LegendPanel'
import MobileChips     from './components/MobileChips'
import MobileSheet     from './components/MobileSheet'
import MapView         from './components/MapView'
import './index.css'
```

- [ ] **Step 2: Update App.jsx state — add leaderboardOpen, remove sidebarOpen**

Find and remove:
```jsx
const [sidebarOpen, setSidebarOpen] = useState(true)
```

Add in its place:
```jsx
const [leaderboardOpen, setLeaderboardOpen] = useState(true)
```

- [ ] **Step 3: Remove the mobile touch drag logic from App.jsx**

Delete the entire `useEffect` block that begins with:
```jsx
// Mobile bottom sheet: tap header to toggle, drag to resize live
const dragStartY = useRef(0)
```
...and ends at `}, [isMobile])` (approximately lines 263–330 in the original file). Also delete the three `useRef` declarations: `dragStartY`, `dragStartHeight`, `isDragging`, and `sheetWrapperRef`.

- [ ] **Step 4: Replace the App.jsx render (return statement)**

Replace the entire `return (...)` block with:

```jsx
  return (
    <div className="app-root">
      {loading && <div className="map-status">Loading layer data…</div>}
      {error   && <div className="map-status error">Error: {error}</div>}
      {IS_PUBLIC_SOURCE && (
        <div className="public-banner">{SOURCE_LABEL} Data</div>
      )}

      {/* Map — always fills full viewport */}
      <div className="map-container">
        <MapView
          layerData={enrichedLayerData}
          activeLayerConfig={activeLayerConfig}
          activeMethodId={activeMethodId}
          colorBreaks={colorBreaks}
          choroplethColors={activeColors}
          showTreeLosses={showTreeLosses}
          showTreeGains={showTreeGains}
          showStreetBuffer={showStreetBuffer}
          streetBufferData={streetBufferData}
          showCanopyChange={showCanopyChange}
          streetCenterlines={streetCenterlines}
          selectedFeatureName={selectedFeatureName}
          hoveredFeature={hoveredFeature}
          onHover={setHoveredFeature}
          onHoverEnd={() => setHoveredFeature(null)}
          onFeatureClick={handleFeatureSelect}
          userLocation={userLocation}
          flyToLocation={flyToLocation}
          onFlyToComplete={() => setFlyToLocation(null)}
          onZoom={handleZoom}
          onMapMove={handleMapMove}
          onStreetViewClose={handleStreetViewClose}
          onActiveTreeChange={setActiveTreeForShare}
          onShare={handleShare}
          isMobile={isMobile}
          sheetState={sheetState}
          initialCenter={mapCenter}
          initialZoom={hashState?.z ?? 11}
          pendingTree={pendingTree}
          onPendingTreeHandled={() => setPendingTree(null)}
        />
      </div>

      {/* Top bar — always visible */}
      <TopBar
        activeLayer={activeLayerConfig}
        layerData={enrichedLayerData}
        selectedFeatureName={selectedFeatureName}
        onFeatureSelect={handleFeatureSelect}
        onShare={handleShare}
        onReset={resetExploration}
        isMobile={isMobile}
        onMobileSearch={() => setSheetState('expanded')}
      />

      {/* ── Desktop panels ── */}
      {!isMobile && (
        <>
          {/* Left icon rail */}
          <nav className="left-rail" aria-label="Map navigation">
            <button className="rail-icon rail-icon--active" title="Map view" aria-label="Map view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
              </svg>
            </button>
            <button
              className={`rail-icon${leaderboardOpen ? ' rail-icon--active' : ''}`}
              onClick={() => setLeaderboardOpen(o => !o)}
              title={leaderboardOpen ? 'Hide leaderboard' : 'Show leaderboard'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
            <div className="rail-divider" />
            <button
              className={`rail-icon${showLocation ? ' rail-icon--active' : ''}`}
              onClick={() => setShowLocation(o => !o)}
              title={locationError || (showLocation ? 'Hide my location' : 'Show my location')}
              disabled={!locationAvailable}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
            </button>
          </nav>

          <LeaderboardPanel
            isOpen={leaderboardOpen}
            layerData={enrichedLayerData}
            activeMethodId={activeMethodId}
            selectedFeatureName={selectedFeatureName}
            onFeatureSelect={handleFeatureSelect}
            onHover={setHoveredFeature}
            onHoverEnd={() => setHoveredFeature(null)}
          />

          <ControlsPanel
            activeBoundaryLayerId={activeBoundaryLayerId}
            onBoundaryLayerChange={handleBoundaryLayerChange}
            activeMethodId={activeMethodId}
            onMethodChange={setActiveMethodId}
            showTreeLosses={showTreeLosses}
            onShowTreeLossesChange={setShowTreeLosses}
            showTreeGains={showTreeGains}
            onShowTreeGainsChange={setShowTreeGains}
            showStreetBuffer={showStreetBuffer}
            onShowStreetBufferChange={setShowStreetBuffer}
            showCanopyChange={showCanopyChange}
            onShowCanopyChangeChange={setShowCanopyChange}
          />

          <LegendPanel
            colorBreaks={colorBreaks}
            activeMethodId={activeMethodId}
            isCoverage={isCoverage}
          />
        </>
      )}

      {/* ── Mobile panels ── */}
      {isMobile && (
        <>
          <MobileChips
            activeBoundaryLayerId={activeBoundaryLayerId}
            onBoundaryLayerChange={handleBoundaryLayerChange}
            activeMethodId={activeMethodId}
            onMethodChange={setActiveMethodId}
            showTreeLosses={showTreeLosses}
            onShowTreeLossesChange={setShowTreeLosses}
            showTreeGains={showTreeGains}
            onShowTreeGainsChange={setShowTreeGains}
          />
          <MobileSheet
            sheetState={sheetState}
            onSheetStateChange={setSheetState}
            selectedFeatureName={selectedFeatureName}
            layerData={enrichedLayerData}
            activeMethodId={activeMethodId}
            isCoverage={isCoverage}
            activeLayer={activeLayerConfig}
            onFeatureSelect={handleFeatureSelect}
            activeBoundaryLayerId={activeBoundaryLayerId}
            onBoundaryLayerChange={handleBoundaryLayerChange}
            onMethodChange={setActiveMethodId}
            showTreeLosses={showTreeLosses}
            onShowTreeLossesChange={setShowTreeLosses}
            showTreeGains={showTreeGains}
            onShowTreeGainsChange={setShowTreeGains}
            showStreetBuffer={showStreetBuffer}
            onShowStreetBufferChange={setShowStreetBuffer}
            showCanopyChange={showCanopyChange}
            onShowCanopyChangeChange={setShowCanopyChange}
            onHover={setHoveredFeature}
            onHoverEnd={() => setHoveredFeature(null)}
            colorBreaks={colorBreaks}
          />
        </>
      )}
    </div>
  )
```

- [ ] **Step 5: Verify desktop — open browser at https://localhost:5173**

Expected:
- Map fills full viewport, dark basemap visible
- Top bar across the top with SHUC logo, search pill, share/reset icons
- Left icon rail with map + leaderboard icons
- Leaderboard panel slides in from left (default open)
- Controls panel floats top-right
- Legend panel bottom-right
- Zoom controls bottom-left (glass-styled MapLibre controls)
- No overlap between any panels

- [ ] **Step 6: Verify mobile — open browser DevTools, switch to mobile viewport (375px)**

Expected:
- Full-screen map
- Top bar with logo and search icon only
- Floating chips row below the top bar
- Bottom sheet peeked at bottom with CTA text
- Swiping up expands sheet to show search + controls + rankings

- [ ] **Step 7: Commit**

```bash
git add web-app/src/App.jsx
git commit -m "Restructure App.jsx: full-screen map with floating glass panels"
```

---

## Task 9: MapView.jsx — keep NavigationControl positioned bottom-left

**Files:**
- Modify: `web-app/src/components/MapView.jsx`

The CSS in Task 1 already overrides `.maplibregl-ctrl-bottom-left` positioning and `.maplibregl-ctrl-group` styling. Verify that MapView renders a `NavigationControl` and that it's positioned at `bottom-left`.

- [ ] **Step 1: Check MapView.jsx for NavigationControl**

Open `web-app/src/components/MapView.jsx`. Search for `NavigationControl`. If it exists but is positioned elsewhere (e.g., `top-right`), change it to `bottom-left`:

```jsx
<NavigationControl position="bottom-left" showCompass={false} />
```

If `NavigationControl` is not in the JSX at all, add it inside the `<Map>` component:

```jsx
import Map, { Source, Layer, Popup, Marker, NavigationControl, ScaleControl } from 'react-map-gl/maplibre'
// (already imported based on line 2 of MapView.jsx)

// Inside the <Map> component JSX, add:
<NavigationControl position="bottom-left" showCompass={false} />
```

- [ ] **Step 2: Verify zoom controls appear**

In the browser, the `+` and `−` buttons should appear at the bottom-left of the map, styled as a glass pill. If they appear in the wrong position, double-check the CSS override:

```css
.maplibregl-ctrl-bottom-left {
  bottom: 16px !important;
  left: calc(var(--rail-w) + var(--lb-w) + 12px) !important;
}
```

When the leaderboard is closed, the zoom controls will still appear at this left offset (which will leave them floating in open map space — that's acceptable). If you want the controls to move when the leaderboard closes, that requires JavaScript repositioning (skip for now — YAGNI).

- [ ] **Step 3: Commit**

```bash
git add web-app/src/components/MapView.jsx
git commit -m "Position NavigationControl bottom-left for glass zoom pill"
```

---

## Task 10: Delete old files and final cleanup

**Files:**
- Delete: `web-app/src/components/Sidebar.jsx`
- Delete: `web-app/src/components/Leaderboard.jsx`

- [ ] **Step 1: Delete the old components**

```bash
rm web-app/src/components/Sidebar.jsx
rm web-app/src/components/Leaderboard.jsx
```

- [ ] **Step 2: Verify no import errors**

The Vite dev server will show an error in the console if anything still imports `Sidebar` or `Leaderboard`. Check `App.jsx` (already cleaned in Task 8) and any other files:

```bash
grep -r "from.*Sidebar\|from.*Leaderboard" web-app/src/
```

Expected output: empty (no matches).

- [ ] **Step 3: Remove leftover sidebar CSS from index.css**

Search index.css for any classes that no longer exist. Because the CSS was fully rewritten in Task 1, there should be nothing to remove — but verify there are no references to `.sidebar`, `.sidebar-wrapper`, `.app-layout`, `.map-container` (old form), or `.leaderboard-list`.

```bash
grep -n "sidebar-wrapper\|app-layout\|leaderboard-list\|leaderboard-toggle\|leaderboard-chevron\|leaderboard-metric\|leaderboard-sort-btn\|leaderboard-row\|leaderboard-rank\|leaderboard-name\|leaderboard-value" web-app/src/index.css
```

Expected output: empty.

- [ ] **Step 4: Full visual check desktop**

Open `https://localhost:5173` in a desktop browser and verify:
1. Top bar: SHUC logo links to SHUC page, search autocompletes, share copies URL, reset clears state
2. Left rail: map icon always green; leaderboard icon toggles panel; location icon shows/hides dot
3. Leaderboard panel: slides in/out; selected boundary shows stats card; clicking a row flies to that zone; sort toggle works
4. Controls panel: boundary chip changes the choropleth; metric radio recolors map; overlays toggles show/hide layers; collapse chevron works
5. Legend panel: updates when metric changes
6. Zoom controls: `+`/`−` styled as glass pill; zoom level changes

- [ ] **Step 5: Full visual check mobile (375 px viewport)**

1. Top bar logo visible; search icon opens sheet
2. Chips row: boundary/metric chips open dropdown; loss/gain chips toggle
3. Bottom sheet: peek shows selected boundary or CTA; swipe up expands; expanded shows search + controls + leaderboard; swipe down returns to peek
4. Street View still works (tap a loss polygon)

- [ ] **Step 6: Run linter**

```bash
cd web-app && npm run lint
```

Expected output: no errors. Fix any unused-variable warnings introduced by removing Sidebar/Leaderboard.

- [ ] **Step 7: Final commit**

```bash
cd /home/scott/Desktop/TreesGIS-ClaudeCode
git add -A
git commit -m "$(cat <<'EOF'
Complete Living Atlas visual refresh

- Map fills full viewport; all UI is fixed-position glass panels
- New components: TopBar, ControlsPanel, LeaderboardPanel, LegendPanel,
  MobileChips, MobileSheet
- TopBar: SHUC logo + frosted search pill (desktop) / search icon (mobile)
  + share/reset buttons
- LeaderboardPanel: selected boundary stats card pinned to top; slide-in
  panel toggled by icon rail; no floating info cards → no panel overlaps
- ControlsPanel: boundary layer chips, metric radio, overlay toggles;
  collapsible; reused inline in MobileSheet
- LegendPanel: color swatches update with active metric
- MobileChips: boundary/metric picker chips + loss/gain toggle chips
- MobileSheet: glass bottom sheet; peek/expanded/full snap states;
  drag logic moved from App.jsx into the component
- index.css: full rewrite with CSS custom properties, glass utilities,
  dark forest palette (#0d0f0c / #9bfc96 / #ff8f06), Manrope + Inter
- Deleted: Sidebar.jsx, Leaderboard.jsx

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

**Spec coverage check:**
- ✅ Full-screen map: `position: fixed; inset: 0` on `.map-container`
- ✅ Dark forest palette: all tokens in `:root` CSS variables
- ✅ Manrope + Inter: Google Fonts in `index.html`, applied via CSS
- ✅ Glassmorphism: `.glass-panel` utility + per-component inline glass rules
- ✅ No solid borders: all borders use ghost-border variables
- ✅ Top bar: `TopBar.jsx` with logo, search, share, reset
- ✅ Left icon rail: in App.jsx render, rail icons toggle leaderboard + location
- ✅ Leaderboard + Details panel: `LeaderboardPanel.jsx`, isOpen prop, selected card at top
- ✅ Controls panel: `ControlsPanel.jsx`, collapsible, chips/radio/toggles
- ✅ Legend panel: `LegendPanel.jsx`, bottom-right, no overlap
- ✅ Zoom controls: CSS override of MapLibre `.maplibregl-ctrl-group`
- ✅ No overlap: zoom at `left: calc(var(--rail-w) + var(--lb-w) + 12px)`, info card absorbed into leaderboard panel
- ✅ Mobile chips row: `MobileChips.jsx`
- ✅ Mobile bottom sheet: `MobileSheet.jsx`, drag/snap preserved from App.jsx
- ✅ Mobile search: sheet auto-focuses input on expand
- ✅ All state, hooks, config, MapLibre logic, Street View: unchanged
