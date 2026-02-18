# Hashline Backport Handoff (2026-02-18, refreshed)

## Tracking
- Beads issue: `pi-mono-cqy` (status: `closed`)
- Branch: `feature/hashline`
- Latest commits:
  - `03b66d1c` fix(coding-agent): use 6-char hashlines with compat anchors
  - `3ca76af2` fix(coding-agent): reject hashline prefixes in edit payloads
  - `f056f331` feat(coding-agent): add hashline edit diff preview
  - `d5fb3ed6` feat(coding-agent): improve hashline anchor recovery
  - `51c86ed8` feat(coding-agent): gate hashline read/grep output
  - `041c8724` docs: refresh hashline backport handoff status

## Completed In This Session
1. Hashline-aware grep + runtime gating
- `grep` supports hashline output format (`path:LINE:HASH|content`)
- hashline output for `read` and `grep` is suppressed when `edit` is not active
- files:
  - `packages/coding-agent/src/core/tools/grep.ts`
  - `packages/coding-agent/src/core/tools/index.ts`
  - `packages/coding-agent/src/core/agent-session.ts`
  - `packages/coding-agent/test/agent-session-hashline-read-gating.test.ts`

2. Hashline validation/recovery parity improvements
- tolerant anchor parsing from noisy references
- bounded and global fallback recovery for drifted anchors
- clearer ambiguity failures
- files:
  - `packages/coding-agent/src/core/tools/hashline.ts`
  - `packages/coding-agent/test/tools.test.ts`

3. TUI diff preview for hashline payloads
- `ToolExecutionComponent` now computes preview diffs for hashline `edits` payloads (not only `oldText/newText`)
- file:
  - `packages/coding-agent/src/modes/interactive/components/tool-execution.ts`

4. Validation
- `npm run check` passes after each slice and commit

## Interactive Smoke Verification
- Used isolated config via `PI_CODING_AGENT_DIR=/tmp/pi-hash-smoke-agent`
- Provider/model validated: `(opencode) minimax-m2.5-free`
- Verified in live TUI:
  - hashline `read` output path
  - hashline `grep` output path (when grep tool explicitly enabled)
  - strict guardrail rejection path with exact error: `Do not include hashline prefixes in replacement text.`
  - runtime hashline formatting check returns 6-char hashes (e.g. `1:be7633|alpha`)

## Final State
- Strict guardrails implemented for hashline edit inputs (`set_line`, `replace_lines`, `insert_after`) to reject `LINE:HASH|...` replacement text.
- Hashline output upgraded from 2 to 6 hex chars.
- Anchor parsing/edit matching remains backward-compatible with shorter legacy anchors (2+ hex chars) via prefix matching.
- Tests updated for guardrails, 6-char hash output, and compatibility behavior.
- Bead children closed:
  - `pi-mono-cqy.1`
  - `pi-mono-cqy.2`
- `npm run check` passing for all committed slices.

## Note
- This handoff is now an archive record; no remaining implementation work is tracked for this slice.
