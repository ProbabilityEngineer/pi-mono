# Tool Guidance Validation Plan

This plan validates that tool-choice guidance remains useful, non-blocking, and availability-aware.

## Coverage goals
- Guidance does not force unavailable tools.
- Guidance keeps LSP assistive (not hard-blocking) in normal editing flow.
- Capability signals and guidance stay deterministic for snapshots/regression tests.

## Recommended tests

### Unit
- Capability-guidance selector:
  - with `astGrep.available=true`, structural rewrite guidance may reference `ast-grep`.
  - with `astGrep.available=false`, `ast-grep` guidance is omitted.
- LSP guidance selector:
  - with `lsp.enabled=false`, semantic guidance is omitted.
  - with `lsp.enabled=true`, semantic guidance is present.

### Integration
- Startup normal mode:
  - concise capability summary appears once.
  - missing optional tools do not emit warning spam.
- Startup verbose mode:
  - structured capability payload appears with deterministic field order.
- Encounter automation:
  - first language encounter updates capability state and preserves prompt guidance constraints.

### Regression
- Existing hooks and LSP defaults remain unchanged.
- `npm run check` passes with no additional warnings/errors.

## Exit criteria
- All new tests pass.
- No change in default LSP behavior (`enabled`, `autoEnableOnEncounter`, `autoInstallOnEncounter` remain default true).
