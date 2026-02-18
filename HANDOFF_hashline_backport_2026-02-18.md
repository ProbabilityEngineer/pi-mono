# Hashline Backport Handoff (2026-02-18, refreshed)

## Tracking
- Beads issue: `pi-mono-cqy` (status: `in_progress`)
- Branch: `feature/hashline`
- Latest commits:
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
  - hashline `read` output
  - hashline `grep` output (when grep tool explicitly enabled)
  - hashline edit/diff preview path executes

## Remaining Risk / Gap
- Model can still misuse hashline editing by copying `LINE:HASH|` into `new_text`/`text`, polluting file content.
- Current hash length is 2 hex chars (256 possibilities), collision-prone for larger files.

## Next Implementation Plan (strict-first)
1. Add edit input guardrails (strict reject)
- In hashline edit apply path, reject replacement/insert lines that begin with hashline prefixes like `^\d+:[0-9a-fA-F]{2,}\|`.
- Error text: `Do not include hashline prefixes in replacement text.`

2. Keep read/grep format unchanged
- Do not change read/grep output format behavior.
- Apply validation only in edit write path.

3. Increase hash robustness to 6 hex chars
- Change generated hash prefix from 2 to 6 chars.
- Keep parser/edit matching backward compatible with shorter anchors when feasible.
- Update tests and snapshots/expectations accordingly.

4. Optional fallback mode (if strict reject is too disruptive)
- Instead of reject, strip leading `LINE:HASH|` on replacement/insert lines.
- Recommended default remains strict reject.

5. Test coverage to add
- rejects prefixed `new_text` in `set_line`
- rejects prefixed `new_text` in `replace_lines`
- rejects prefixed `text` in `insert_after`
- 6-char hash generation and parse compatibility cases

## Suggested Starter Prompt For Next Agent
"Read `AGENTS.md`, `bd show pi-mono-cqy`, and `HANDOFF_hashline_backport_2026-02-18.md`. Implement strict hashline edit guardrails to reject `LINE:HASH|` prefixes in replacement/insert text, then upgrade hashline output hashes to 6 hex chars with backward-compatible anchor parsing. Update tests, run `npm run check`, commit in focused slices, update bead notes, and push."
