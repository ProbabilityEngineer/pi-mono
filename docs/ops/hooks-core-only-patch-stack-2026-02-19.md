# Hooks Core-Only Patch Stack (2026-02-19)

Issue: `pi-mono-737.5`

Goal: keep hooks runtime + guardrails as an isolated, replayable core delta after upstream sync.

Base for replay: `upstream/main@3a3e37d3`

## Scope (core-only)

- `packages/coding-agent/src/core/hooks/**`
- hook lifecycle wiring/tests in `packages/coding-agent/test/hooks-*.test.ts`
- minimal hook-adjacent glue changes required by hooks runtime behavior

## Ordered Commit Stack

Apply in this order (oldest -> newest):

1. `0948b21f` `slice: add hook config model and source abstraction`
2. `631807ce` `slice: implement hook config precedence resolver`
3. `83f92ad8` `slice: add hook command runner with timeout and truncation`
4. `252e9be1` `slice: wire hook runner into session lifecycle`
5. `7d0294b5` `slice: enforce pretool exit-code-2 blocking semantics`
6. `af1629d3` `slice: add gastown built-in default hook resolution`
7. `90d85a9d` `slice: add post tool use failure hook event`
8. `85243149` `slice: add optional claude settings hook config loader`
9. `a1f981a4` `slice: detect invalid runtime hook config by source`
10. `59a48a70` `slice: disable hooks session on invalid runtime config`
11. `d5a9e93e` `slice: add structured hook invocation logging fields`
12. `a498ce34` `slice: redact sensitive values in hook invocation logs`
13. `35961392` `slice: truncate hook log output with metadata flags`
14. `67d6219e` `slice: add startup warning formatter coverage`
15. `bdfda08d` `slice: guardrail deny reasons in hook invocation logs`
16. `14b6e88f` `slice: normalize runtime hook config error reasons`
17. `c663a0aa` `slice: add verbose structured invalid-hook warning details`
18. `d9f2615e` `slice: format startup warning helper updates`

## Replay Procedure

```bash
# starting from a branch based on upstream/main
git cherry-pick -x 0948b21f 631807ce 83f92ad8 252e9be1 7d0294b5 af1629d3 90d85a9d 85243149 a1f981a4 59a48a70 d5a9e93e a498ce34 35961392 67d6219e bdfda08d 14b6e88f c663a0aa d9f2615e
```

If conflicts occur:
- resolve only hooks-scope files first,
- defer non-hooks cross-cutting changes to follow-up slices.

## Unavoidable Core Delta Rationale

Hooks runtime and guardrails are core-coupled because they intercept tool lifecycle execution, decision flow, and logging internals. This behavior cannot be fully externalized to extension-only surfaces without losing enforcement semantics.
