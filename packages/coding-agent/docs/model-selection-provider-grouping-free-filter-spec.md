# Model Selection UX Spec: Provider Grouping + Free-Only Filter

## Summary

Improve `/model` model discoverability and reduce noise by:

1. Grouping models by provider in `/model` (for example: `opencode`, `openrouter`).
2. Adding a `/settings` toggle to show only models whose IDs include `"free"` when browsing/selecting models.

The free-only filter defaults to off.

## Scope

### In Scope

- Interactive model picker (`/model`) grouping by provider.
- New persisted setting exposed in `/settings`.
- Model list filtering behavior wired to the setting.
- Tests for grouping, filtering, and persistence.
- Documentation updates for `/settings` and model selection behavior.

### Out of Scope

- Changing model capability resolution, auth rules, or provider fallback logic.
- Renaming model IDs from upstream providers.
- Creating new provider integrations.

## UX Requirements

## `/model` grouping by provider

- Models are rendered in provider sections.
- Section header format: provider name, plus model count in that section.
- Providers are sorted alphabetically by provider ID for deterministic behavior.
- Models inside a provider are sorted using existing sort behavior (preserve current ranking/sort rules).
- Existing search/filter within selector continues to work across grouped results.

## `/settings` free-only toggle

- Add a new boolean setting item in `/settings`:
  - Label: `Models: show only "free" IDs`
  - Type: toggle
  - Default: `false`
- Help text clarifies the matching rule:
  - Included when `model.id.toLowerCase().includes("free")` is true.
- Toggling updates in-memory behavior immediately and persists through `SettingsManager`.

## Filtering behavior

- When enabled, model selector includes only models with `"free"` in the model ID.
- Filter applies before rendering grouped sections.
- Provider headers with zero matching models are hidden.
- If no models match, show an empty-state hint that references the setting and suggests toggling it off.

## Settings Schema

Add a new persisted setting key:

- `modelFreeOnlyFilter: boolean` (default `false`)

Required updates:

- Default settings definition.
- Settings manager getter/setter.
- Interactive settings selector item list.
- Documentation of key in settings docs/readme tables where applicable.

## Compatibility and Migration

- Existing user settings files remain valid; missing key resolves to default `false`.
- No migration step required unless settings schema tests enforce explicit defaults.

## Implementation Notes

- Keep grouping logic in model selector/scoped model selector layer, not in registry, to avoid changing model API contracts.
- Keep free-filter predicate centralized in one helper used by both selector construction and tests.
- Maintain keyboard navigation semantics across section boundaries.

## Acceptance Criteria

1. `/model` displays grouped provider sections for mixed-provider model sets.
2. `/settings` includes `Models: show only "free" IDs`, default off on fresh config.
3. With toggle off, all previously visible models remain visible.
4. With toggle on, only model IDs containing `"free"` are shown (case-insensitive).
5. Provider headers with no matching models are not rendered.
6. Empty-state message appears when filter excludes all models.
7. Setting persists to settings JSON and is respected after restart.
8. Unit tests cover grouping, free-only filtering, and persisted setting behavior.
9. Documentation for model selection/settings reflects new behavior.

## Epic Breakdown

## Epic A: Group `/model` results by provider

Branch: `epic/model-selector-group-by-provider`

Deliverables:

- Grouped model selector rendering.
- Stable provider ordering.
- Updated selector tests for grouped output and navigation.

## Epic B: Add free-only model filter setting

Branch: `epic/settings-model-free-only-filter`

Deliverables:

- New settings key and `/settings` toggle (default false).
- Free-only filter applied to model list before grouping.
- Empty-state UX and test coverage.
- Settings/docs updates.
