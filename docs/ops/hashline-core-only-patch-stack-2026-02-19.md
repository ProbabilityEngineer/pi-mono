# Hashline Core-Only Patch Stack (2026-02-19)

Issue: `pi-mono-737.6`

Goal: keep hashline read/edit/write behavior as an isolated, replayable core delta after upstream sync.

Base for replay: `upstream/main@3a3e37d3`

## Scope (core-only)

- `packages/coding-agent/src/core/tools/hashline.ts`
- hashline-aware tool glue in `read`/`grep`/`edit`/`write` and tool execution rendering
- hashline gating/wiring in session flow and related tests

## Ordered Commit Stack

Apply in this order (oldest -> newest):

1. `c4dcfa11` `feat(coding-agent): backport initial hashline editing support`
2. `51c86ed8` `feat(coding-agent): gate hashline read/grep output`
3. `d5fb3ed6` `feat(coding-agent): improve hashline anchor recovery`
4. `f056f331` `feat(coding-agent): add hashline edit diff preview`
5. `3ca76af2` `fix(coding-agent): reject hashline prefixes in edit payloads`
6. `03b66d1c` `fix(coding-agent): use 6-char hashlines with compat anchors`
7. `9b99d4fd` `slice: add hashline concurrency stress validation test`
8. `d6a043d0` `slice: add hashline stress matrix and metrics assertions`

## Replay Procedure

```bash
# starting from a branch based on upstream/main
git cherry-pick -x c4dcfa11 51c86ed8 d5fb3ed6 f056f331 3ca76af2 03b66d1c 9b99d4fd d6a043d0
```

If conflicts occur:
- resolve `core/tools/*` and `interactive/components/tool-execution.ts` first,
- keep non-hashline behavior unchanged while replaying.

## Unavoidable Core Delta Rationale

Hashline requires deterministic anchor generation and validation inside core tool execution paths. Because it mutates canonical read/edit/write flows and tool output semantics, this behavior cannot be cleanly implemented as extension-only logic today.
