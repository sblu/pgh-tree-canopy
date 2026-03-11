# Street View Before/After Imagery

Embed historical and current Google Street View static imagery in a comparison popup, replacing the current link-only approach when a valid API key is configured.

## Approach

Use the Google Maps JavaScript API client-side with HTTP referrer restrictions and quota caps. The JS SDK is loaded lazily on first polygon click. `StreetViewService` (free) discovers panorama IDs and dates. The Street View Static API ($7/1,000 requests) renders images. 10,000 free Static API requests/month = ~5,000 popup opens before any cost.

No server-side components. The API key is restricted by HTTP referrer in Google Cloud Console, locked to only the Street View and Maps JS APIs, and protected by a daily quota cap.

## API Key Management

- `.env` (gitignored) holds the real key: `VITE_GOOGLE_MAPS_API_KEY=AIza...`
- `.env.example` (checked into git) has a placeholder: `VITE_GOOGLE_MAPS_API_KEY=your-api-key-here`
- Vite exposes it at build time as `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
- If the env var is empty or missing, the Street View imagery feature is fully disabled. The app uses the current link-only behavior with no errors or broken UI.

## Click Flow

1. User clicks a loss/gain polygon.
2. `clickedTree` state is set in MapView. TreePopup renders with "Loading Street View..." where the button normally appears.
3. `useStreetView` hook reacts: loads the Maps JS SDK (first click only), then calls `StreetViewService.getPanorama()` with a 50m radius at the computed camera position.
4. **Success:** `panoData` populates. The MapLibre click Popup is dismissed and `StreetViewModal` auto-opens as a fixed overlay.
5. **Permanent failure (SDK load error, 403, invalid key):** `disabled` flag is set and cached. TreePopup swaps to the regular "Open in Google Street View" link. All subsequent clicks skip the API and go straight to the link.
6. **Transient failure (network timeout, `ZERO_RESULTS` for this location):** Falls back to the link for this polygon only. Does not set `disabled` — the next click will try the API again.
7. **Second polygon clicked while modal is open:** Modal closes, `panoData` resets, new fetch begins. The new TreePopup shows "Loading Street View..." as usual.

## Panorama Selection

From the `StreetViewService` response, extract the time array (list of available panoramas with dates and pano IDs):

- **Current image:** most recent pano ID.
- **Historical image:** newest pano ID dated March 2015 or earlier. If none exists, the modal shows only the current image with "No 2015 or earlier imagery available."

## Fallback Hierarchy

| Scenario | Behavior |
|---|---|
| API key not configured | Link-only TreePopup (current behavior, no loading state) |
| SDK fails to load / 403 / invalid key | Brief loading in TreePopup, falls back to link, caches failure permanently |
| Transient failure (network, timeout) | Falls back to link for this polygon only, retries on next click |
| `ZERO_RESULTS` (no coverage at this point) | Falls back to link for this polygon only (not a permanent failure) |
| Service works, both time periods found | Full before/after modal |
| Service works, no historical pano | Modal with current image + "No 2015 or earlier imagery available" |
| Modal open, image fails to load | Message in modal instead of broken image icon |

## New Files

### `web-app/src/hooks/useStreetView.js`

Custom hook that manages the Street View data lifecycle.

**Inputs:** `clickedTree` (feature + lngLat), `streetCenterlines` (GeoJSON FeatureCollection)

**Outputs:**
- `loading` (boolean) — fetch in progress
- `disabled` (boolean) — API unavailable, cached across clicks
- `panoData` (object or null):
  - `currentImageUrl` — Static API URL using current pano ID
  - `historicalImageUrl` — Static API URL using historical pano ID, or null
  - `currentDate` — formatted date string (e.g., "June 2024")
  - `historicalDate` — formatted date string, or null
  - `streetViewUrl` — link to open Google Street View directly

**Behavior:**
- On first invocation with a clickedTree, lazy-loads the Google Maps JS SDK via a `<script>` tag.
- Calls a new `getStreetViewPosition()` export from `utils/streetView.js` (see below) to get `{ lat, lng, heading }` — the raw camera coordinates and bearing toward the centroid.
- Calls `google.maps.StreetViewService().getPanorama({ location: {lat, lng}, radius: 50 })` at the computed camera position.
- Parses the time array to find current and historical (<=March 2015) pano IDs.
- Constructs Static API URLs: `https://maps.googleapis.com/maps/api/streetview?size=600x400&pano=PANO_ID&heading=H&pitch=0&key=KEY`
- On permanent failure (SDK load error, 403, invalid key), sets `disabled = true` (persisted in a ref, not reset across clicks).
- On transient failure (network, `ZERO_RESULTS`), does not set `disabled`. Returns null `panoData` for this click only.

### `web-app/src/components/StreetViewModal.jsx`

Full-viewport modal overlay for the before/after comparison.

**Props:** `panoData`, `isGain` (boolean), `feature` (for header info), `onClose` (callback)

**Layout (Option C — responsive):**
- Side-by-side on desktop/tablet (flexbox, each image `flex:1; min-width:200px`).
- Automatically stacks vertically on narrow screens via `flex-wrap:wrap`.
- Header: "Canopy Loss — Single tree (0.045 acres)" (or Gain equivalent) + close button.
- Before image on left/top with label: "Before — August 2014"
- After image on right/bottom with label: "After — June 2024"
- If no historical image: single current image with "No 2015 or earlier imagery available" message.
- "Open in Google Street View" button below images.
- Semi-transparent backdrop. Click backdrop or X to close.
- `<img onerror>` handler replaces broken images with a fallback message.

### `web-app/.env.example`

```
VITE_GOOGLE_MAPS_API_KEY=your-api-key-here
```

## Modified Files

### `web-app/src/utils/streetView.js`

- Refactor to extract a new export: `getStreetViewPosition(centroidLat, centroidLon, streetCenterlines)` that returns `{ lat, lng, heading }` — the raw camera coordinates and bearing. Returns null if inputs are missing or no street is close enough.
- `getStreetViewUrl()` is refactored to call `getStreetViewPosition()` internally and format the URL from the returned values. Its public API does not change.
- This avoids duplicating turf logic and avoids parsing heading back out of a URL string.

### `web-app/src/components/TreePopup.jsx`

- **TreePopup keeps its existing `getStreetViewUrl` call** for the fallback link. This ensures the link always works regardless of API state.
- New props from MapView: `streetViewLoading` (boolean), `streetViewDisabled` (boolean).
- When API key is configured, not disabled, and loading: show "Loading Street View..." in place of the link.
- When API key is configured, not disabled, and not loading (panoData arrived): TreePopup is behind the modal so its content doesn't matter.
- When API is not configured, disabled, or transiently failed: show the existing link from `getStreetViewUrl` (current behavior, unchanged).

### `web-app/src/components/MapView.jsx`

- Import and call `useStreetView(clickedTree, streetCenterlines)`.
- Track `showStreetViewModal` state. Auto-open when `panoData` arrives.
- When modal opens, dismiss the MapLibre click Popup (`setClickedTree(null)` or equivalent) so both aren't visible simultaneously.
- When a new polygon is clicked while the modal is open: close the modal, reset panoData, begin new fetch.
- Render `StreetViewModal` as a fixed-position overlay (sibling to the Map, inside the same container).
- Pass `streetViewLoading` and `streetViewDisabled` to TreePopup.

### `web-app/.gitignore`

- Add `.env` entry. (The `.env` file lives in `web-app/` alongside `vite.config.js`, so `web-app/.gitignore` is the correct location.)

## Cost Summary

- Maps JS SDK load: free
- `StreetViewService.getPanorama()`: free
- Street View Static API: $7/1,000 requests (2 per popup open = $14/1,000 opens)
- First 10,000 Static API requests/month: free (~5,000 popup opens)
- Daily quota cap configurable in Google Cloud Console

## Google Cloud Console Setup (Manual)

1. Enable "Maps JavaScript API" and "Street View Static API" for the project.
2. Create an API key. Restrict it to these two APIs only.
3. Add HTTP referrer restriction for the production domain.
4. Set a daily quota limit (e.g., 500 requests/day) as a cost ceiling.
