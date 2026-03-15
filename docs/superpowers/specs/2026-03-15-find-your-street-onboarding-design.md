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

The existing landing prompt card gains two action buttons below the body text:

- **"Find your neighborhood"** — keeps current behavior (boundary layer stays on neighborhoods, search label "Find Your Neighborhood")
- **"Find your street"** — sets `streetPath = true`, switches boundary layer to `streets`, search label changes to "Find Your Street"

Both buttons dismiss the landing card by advancing the exploration stage.

### State: `streetPath`

New boolean state in `App.jsx`, default `false`.

- Set to `true` when user clicks "Find your street" on the landing card
- Reset to `false` by `resetExploration()`, which also switches boundary back to `neighborhoods`

### State Machine

New transition added:

```
landing → street-level  (when selectedFeatureName && streetPath)
```

The existing transition is unchanged:

```
landing → neighborhood  (when selectedFeatureName && !streetPath)
```

The `neighborhood → street-level` transition still exists but won't fire on the street path because it skips `neighborhood` entirely.

### Map Behavior

When a street is selected via the street path, the map flies to the street's bounding box at zoom ~14 (using existing `flyToFeature` / feature-select behavior — street geometries are lines so the bounding box zoom will naturally be higher than for polygon neighborhoods).

### Prompt Card Suppression

| Stage | Neighborhood path | Street path |
|-------|------------------|-------------|
| `landing` | Landing card with two buttons | Same |
| `neighborhood` | Neighborhood insight card | Skipped (stage never entered) |
| `street-level` | "You can see the tree losses now" card | Suppressed |
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
- `web-app/src/components/Sidebar.jsx` — landing card buttons, search label conditional, prompt card suppression
- `web-app/src/config/layers.js` — update `PROMPT_CARDS.landing` to include button labels (optional, could be inline)

## Out of Scope

- Street-specific insight card (equivalent of neighborhood stats card)
- Changing the leaderboard behavior for streets
- Modifying the post-streetview CTA flow
