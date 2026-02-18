# Hashline Parity Audit (pi-mono-2cp.1)

Date: 2026-02-18

## Scope

Audit current hashline behavior in `packages/coding-agent` against Oh-My-Pi parity goals, and identify minimal safe backports or explicit non-goals.

## Current Behavior Inventory

1. Hashline addressing is implemented with `LINE:HASH` anchors and accepts hash prefixes.
2. Hash computation emits 6 hex chars and remains backward compatible with 2-char anchors.
3. Anchor resolution supports drift recovery near the requested line and global fallback search.
4. Ambiguous anchors fail fast with explicit error messages and re-read guidance.
5. Hashline-prefixed replacement payloads are rejected for `set_line`, `replace_lines`, and `insert_after`.
6. `read` and `grep` hashline output is gated to edit workflows (enabled only when edit tool is active and hashline mode or `readHashLines` setting is enabled).
7. Edit tool runtime supports two modes only: `replace` and `hashline`.

## Parity Delta

1. `EditSettings.mode` type still includes `"patch"` while runtime and UI do not expose patch mode:
   - Type allows `"replace" | "hashline" | "patch"` in `settings-manager.ts`.
   - `getEditMode()` collapses non-`"replace"` values to `"hashline"`.
   - `setEditMode()` only accepts `"replace" | "hashline"`.
   - `edit` tool mode union is `"replace" | "hashline"`.
2. No additional high-risk gaps were identified in hashline validation/recovery behavior for this slice.

## Minimal Safe Backports / Decisions

1. Keep current hashline runtime behavior as-is (already includes drift recovery, ambiguity checks, and compatibility handling).
2. Treat patch mode parity as a separate follow-up instead of forcing an in-slice behavior change.

## Follow-up Work

1. Resolve patch-mode mismatch explicitly:
   - Option A: implement patch-mode runtime and UI parity.
   - Option B: remove `"patch"` from public settings type and docs to match actual behavior.

## References

- `packages/coding-agent/src/core/tools/hashline.ts`
- `packages/coding-agent/src/core/tools/edit.ts`
- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/test/tools.test.ts`
- `packages/coding-agent/test/agent-session-hashline-read-gating.test.ts`
