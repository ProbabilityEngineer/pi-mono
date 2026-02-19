# pi-mono Gastown Hooks — Roadmap

This document outlines potential future directions.  
Items here are exploratory and NOT implementation requirements.

---

## Near-term (post v1.1)

- Complete remaining v1.1 deltas:
  - structured JSON decision parsing from hook stdout
  - `updatedInput` mutation for PreToolUse
  - deterministic structured hook-context injection flow
- Hook decision UX hardening (`ask` policy behavior once permission UI exists)
- Hook context visibility controls (user-facing inspection/toggle)
- Improved matcher support (tool name + simple patterns)
- Config validation tooling
- Better error surfacing for hook failures

### Recently completed (beads, 2026-02-19)

- `pi-mono-1km`: Hook runtime-config invalid behavior + user warning
- `pi-mono-15s`: Hook execution logging guardrails
- `pi-mono-b4c`: Validation, tests, and docs rollout
- follow-up polish slices for `pi-mono-1km.*` and `pi-mono-15s.*`

### Already implemented (moved out of roadmap)

- Optional `.claude/settings*.json` compatibility layer (feature-flagged)
- `PostToolUseFailure` event support

---

## Medium-term

- Rich matcher DSL
  - regex support
  - tool argument matching
  - conditional execution

- Hook performance budgets
  - max execution time per lifecycle phase
  - warning thresholds

- Metrics and tracing
  - hook duration metrics
  - hook execution counts
  - error rate tracking

- Structured audit trail
  - hook decision history
  - tool decision provenance

---

## Longer-term

- Permission workflow integration
  - interactive approvals
  - policy engines
  - role-based decisions

- Hook sandboxing
  - restricted execution environments
  - allowlist commands
  - resource limits

- Multi-agent hook routing
  - different hook configs per role/agent
  - workspace-level overrides

- Hook plugin ecosystem
  - reusable hook packages
  - versioned hook bundles

---

## Observability

Potential additions:

- Hook timeline visualization
- Debug mode with hook payload dumps
- Replay capability for hook decisions

---

## Stability goals

Future versions should maintain:

- deterministic hook ordering
- backward-compatible config model
- minimal startup overhead
- no dependency on Claude Code binaries
- deterministic hook-context injection ordering

---

## Decision principle

Features should only graduate from roadmap to spec after:

1. Real-world usage reveals need
2. Clear implementation path exists
3. Backward compatibility is understood
4. Complexity is justified

---

## Version trajectory (informational)

v1 → operational compatibility  
v1.1 → runtime configurability  
v1.2 → robustness improvements  
v2 → first-class hooks platform  

---

End of roadmap.
