# Model Selection UX Spec: Provider Grouping + Free Models Command

## Summary

Improve `/model` model discoverability and reduce noise by:

1. Grouping models by provider in `/model` (for example: `opencode`, `openrouter`).
2. Adding a `/freemodel` command to open a selector that only shows models whose IDs include `"free"`.

## Scope

### In Scope

- Interactive model picker (`/model`) grouping by provider.
- New `/freemodel` command in interactive mode.
- Model list filtering behavior wired to command mode.
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

## `/freemodel` command

- Add a new slash command: `/freemodel`.
- `/freemodel` opens the model selector pre-filtered to model IDs containing `"free"` (case-insensitive).
- `/model` always shows the full model list (subject to existing auth/scope constraints).

## Filtering behavior

- When enabled, model selector includes only models with `"free"` in the model ID.
- Filter applies before rendering grouped sections.
- Provider headers with zero matching models are hidden.
- If no models match, show an empty-state hint that directs users to `/model` for the full list.

## Compatibility and Migration

- No persistent setting state for this feature, so no migration is required.

## Implementation Notes

- Keep grouping logic in model selector/scoped model selector layer, not in registry, to avoid changing model API contracts.
- Keep free-filter predicate centralized in one helper used by both selector construction and tests.
- Maintain keyboard navigation semantics across section boundaries.

## Acceptance Criteria

1. `/model` displays grouped provider sections for mixed-provider model sets.
2. `/freemodel` opens a selector filtered to model IDs containing `"free"` (case-insensitive).
3. `/model` continues to show all previously visible models.
5. Provider headers with no matching models are not rendered.
6. Empty-state message appears when filter excludes all models.
7. Unit tests cover grouping and `/freemodel` filtering behavior.
8. Documentation for model selection reflects new behavior.

## Epic Breakdown

## Epic A: Group `/model` results by provider

Branch: `epic/model-selector-group-by-provider`

Deliverables:

- Grouped model selector rendering.
- Stable provider ordering.
- Updated selector tests for grouped output and navigation.

## Epic B: Add `/freemodel` filtered selector

Branch: `epic/settings-model-free-only-filter`

Deliverables:

- New `/freemodel` command.
- Free-only filter applied to selector list before grouping when `/freemodel` is used.
- Empty-state UX and test coverage.
- Command/docs updates.
