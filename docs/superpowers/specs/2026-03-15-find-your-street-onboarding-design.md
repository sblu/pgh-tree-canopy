# "Find Your Street" Onboarding Path

## Goal

Add a parallel onboarding path that lets users jump straight to street-level exploration, bypassing the neighborhood stage entirely.

## Current Flow

```
landing → neighborhood → street-level → post-streetview → exploring
```

The landing card says "Pittsburgh's tree canopy is shrinking" and the search defaults to neighborhoods. Users must select a neighborhood, zoom in, then discover street-level details.

## Design

### Landing Card

The existing landing prompt card gains two action buttons below the body text, stacked vertically and styled like `prompt-action` links:

- **"Find your neighborhood"** — no-op (search is already set to neighborhoods). Included for symmetry so the user sees the choice.
- **"Find your street"** — calls `onStreetPathStart()`, which sets `streetPath = true` and switches boundary layer to `streets`.

**Neither button changes the exploration stage.** The landing card stays visible until the user selects a feature from search, at which point the state machine transitions fire. This keeps the landing card as a passive prompt — the user interacts via the search bar, not the buttons.

The landing card still uses the existing `!hasVisited` guard — returning users don't see it.

### Search Label

The hardcoded "Find Your Neighborhood" label becomes conditional on `streetPath`:
- `streetPath === false` → "Find Your Neighborhood"
- `streetPath === true` → "Find Your Street"

### State: `streetPath`

New boolean state in `App.jsx`, default `false`.

- Set to `true` when user clicks "Find your street" on the landing card
- Reset to `false` by `resetExploration()`, which also switches boundary back to `neighborhoods`
- Reset to `false` if the user manually changes the boundary layer via the Advanced dropdown (to avoid stale state when boundary no longer matches the flag)

### State Machine

Modify the existing `landing → neighborhood` transition to add a `!streetPath` guard:

```
landing → neighborhood   (when selectedFeatureName && !streetPath)
```

Add new transition:

```
landing → street-level   (when selectedFeatureName && streetPath)
```

The `neighborhood → street-level` transition still exists but won't fire on the street path because it skips `neighborhood` entirely.

### Map Behavior

When a street is selected, the map flies to the street's bounding box via the existing `fitBounds` logic (capped at `maxZoom: 15`). No changes to MapView needed — street line geometries naturally produce a tighter bounding box than polygon neighborhoods.

### Prompt Card Suppression

| Stage | Neighborhood path | Street path |
|-------|------------------|-------------|
| `landing` | Landing card with two action links | Same |
| `neighborhood` | Neighborhood insight card | Skipped (stage never entered) |
| `street-level` | "You can see the tree losses now" card | Suppressed (`streetPath` guard) |
| `post-streetview` | CTA card | Same (shown normally) |

### Props

- `streetPath: boolean` — passed to Sidebar
- `onStreetPathStart: () => void` — callback passed to Sidebar; sets `streetPath = true` and calls `onBoundaryLayerChange('streets')`

### Reset

`resetExploration()` in `App.jsx` adds:
- `setStreetPath(false)`
- `handleBoundaryLayerChange('neighborhoods')` (restores default boundary)

## Files Modified

- `web-app/src/App.jsx` — new state, transition, callback, reset logic, props
- `web-app/src/components/Sidebar.jsx` — landing card action links, search label conditional, prompt card suppression

No changes to `config/layers.js` — button labels are inline in Sidebar.

## Edge Cases

- **User changes boundary layer manually while `streetPath = true`:** Reset `streetPath` to `false` in `handleBoundaryLayerChange` when the new layer is not `streets`.
- **Returning users (`hasVisited`):** Landing card is still suppressed. They can reach streets via the Advanced dropdown as before.
- **Mobile sheet:** Auto-expand on stage change works the same — `landing → street-level` triggers it.

## Out of Scope

- Street-specific insight card (equivalent of neighborhood stats card)
- Changing the leaderboard behavior for streets
- Modifying the post-streetview CTA flow
