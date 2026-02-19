# LSP Core-Only Patch Stack (2026-02-19)

Issue: `pi-mono-737.7`

Goal: keep the LSP backport + runtime wiring as an isolated, replayable core delta after upstream sync.

Base for replay: `upstream/main@3a3e37d3`

## Scope (core-only)

- `packages/coding-agent/src/lsp/**`
- `packages/coding-agent/src/core/tools/lsp.ts`
- LSP settings/runtime wiring in interactive mode/settings manager
- LSP-related tests under `packages/coding-agent/test/lsp-*.test.ts`

## Ordered Commit Stack

Apply in this order (oldest -> newest):

1. `0f20fb06` `feat(coding-agent): backport lsp client transport and mux lifecycle`
2. `35af8a5e` `feat(coding-agent): backport lsp read-only api operations`
3. `178cbb88` `feat(coding-agent): wire lsp tool into runtime and prompt`
4. `fe373036` `feat(coding-agent): add lsp diagnostics rename and format pathways`
5. `7b37686d` `fix(coding-agent): harden windows lsp command probing`
6. `22e10485` `refactor(coding-agent): introduce lsp command probe contract`
7. `7f17ada6` `fix(coding-agent): gate lsp planner/installer with probe checks`
8. `785599cd` `fix(coding-agent): pass stdio args to default LSP servers`
9. `214e74f6` `feat(coding-agent): backport oh-my-pi lsp defaults and detection`
10. `59451f71` `feat(coding-agent): merge typescript lsp tuning from oh-my-pi`
11. `9d32414f` `feat(coding-agent): add lsp rootMarkers and isLinter schema fields`
12. `b15953e8` `feat(coding-agent): add linter-aware lsp server role selection`
13. `eb83a106` `feat(coding-agent): add lsp status and reload tool actions`
14. `2f7e0c56` `feat(coding-agent): expand lsp config discovery to yaml and extra paths`
15. `622fdf20` `feat(coding-agent): improve lsp guidance and symbol filtering`
16. `fe88be49` `feat(coding-agent): backport lazy LSP encounter install and follow-up planning`
17. `651a5110` `feat(coding-agent): add hashline/LSP settings with live runtime rebuild` (resolve for LSP scope only)

## Replay Procedure

```bash
# starting from a branch based on upstream/main
git cherry-pick -x 0f20fb06 35af8a5e 178cbb88 fe373036 7b37686d 22e10485 7f17ada6 785599cd 214e74f6 59451f71 9d32414f b15953e8 eb83a106 2f7e0c56 622fdf20 fe88be49 651a5110
```

If conflicts occur:
- resolve `src/lsp/**` and `core/tools/lsp.ts` first,
- for mixed commits, keep only LSP-related hunks and drop unrelated deltas.

## Unavoidable Core Delta Rationale

LSP support is tightly coupled to core transport, tool execution, planner/install workflow, and interactive runtime state. These paths cannot currently be externalized as extension-only behavior without losing correctness and performance.
