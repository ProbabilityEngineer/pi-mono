# Hashline Backport Handoff (2026-02-18)

## Tracking
- Beads issue: `pi-mono-cqy` (status: `in_progress`)
- Branch: `feature/hashline`

## What Was Completed
- Added hashline utility module:
  - `packages/coding-agent/src/core/tools/hashline.ts`
  - Provides:
    - `computeLineHash(lineNum, line)` -> 2-char hex hash
    - `formatHashLines(content, startLine)` -> `LINE:HASH|content` formatting
    - `parseLineRef("LINE:HASH")`
    - `applyHashlineEdits()` for:
      - `set_line`
      - `replace_lines`
      - `insert_after`
- Added hashline edit mode path in:
  - `packages/coding-agent/src/core/tools/edit.ts`
  - Supports `PI_EDIT_VARIANT=hashline` and tool option `editMode: "hashline"`.
- Added optional hashline output in read tool:
  - `packages/coding-agent/src/core/tools/read.ts`
  - New option: `hashLines?: boolean`
  - Text output can be formatted as `LINE:HASH|content` while preserving trailing read notices.
- Wired runtime settings into tool creation:
  - `packages/coding-agent/src/core/agent-session.ts`
  - Passes:
    - `read.hashLines` (`settings.readHashLines || settings.edit.mode === "hashline"`)
    - `edit.editMode` from settings
- Added settings support:
  - `packages/coding-agent/src/core/settings-manager.ts`
  - Added:
    - `settings.edit.mode`
    - `settings.readHashLines`
    - getters: `getEditMode()`, `getReadHashLines()`
- Updated tool exports/options:
  - `packages/coding-agent/src/core/tools/index.ts`
- Added initial tests:
  - `packages/coding-agent/test/tools.test.ts`
  - Includes:
    - read hashline prefix test
    - hashline edit success test
    - stale hashline anchor failure test

## Current Working Tree (Uncommitted)
- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/src/core/tools/edit.ts`
- `packages/coding-agent/src/core/tools/index.ts`
- `packages/coding-agent/src/core/tools/read.ts`
- `packages/coding-agent/src/core/tools/hashline.ts` (new)
- `packages/coding-agent/test/tools.test.ts`

## Validation Status
- Could not run full checks in this environment:
  - `npm run check` fails: `biome: command not found`
  - `npx tsc ...` fails due network-restricted npm lookup (`ENOTFOUND registry.npmjs.org`)

## Known Gaps / Next Slices
1. Add hashline-aware `grep` output (parity with read/hashline mode behavior).
2. Suppress hashline output when edit tool is unavailable (source parity: `05cc2583` behavior).
3. Improve hashline validation and recovery parity with `oh-my-pi` (current implementation is minimal, strict, and lacks advanced normalization/recovery heuristics).
4. Verify TUI edit preview behavior with hashline payloads (`tool-execution` currently expects `oldText/newText` shape for preview).
5. Run full quality gates once tooling/network are available.

## Recommended Immediate Next Step
- Continue on `feature/hashline` with slice #2 (suppress hashline output when edit tool not active), then slice #1 (`grep` hashline formatting), because these reduce user-facing inconsistency quickly with limited risk.
