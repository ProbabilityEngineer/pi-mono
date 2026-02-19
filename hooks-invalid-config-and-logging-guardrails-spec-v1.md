# Hooks Invalid Config + Logging Guardrails Spec v1

## Purpose
Define deterministic behavior when runtime hook config is invalid, and define safe logging guardrails for hook execution.

## Scope
- Coding agent hooks resolution and execution path.
- User-facing warnings for invalid runtime config.
- Hook execution logging redaction/truncation/verbosity behavior.

## Non-goals
- Permission UI (`ask` remains non-interactive).
- Hook sandboxing.
- Matcher DSL expansion.
- New hook lifecycle events.

## Decision (locked)
If runtime hook config is present but invalid:
- disable hooks for the current session,
- do not execute built-in Gastown defaults for that session,
- show a clear user-facing warning with source and reason,
- continue session startup (no hard exit).

Rationale:
- avoids silent policy substitution,
- avoids total workflow outage from config typos.

## Definitions
- Runtime config source: `--hooks-config`, `PI_HOOKS_JSON`, optional `.claude/settings*.json` loader.
- Invalid runtime config: unreadable path, invalid JSON, or schema validation failure.
- User-facing warning: concise message visible in startup output (stderr/log line), not hidden behind debug-only mode.

## Required behavior

### 1. Invalid runtime config handling
- Detect source-level failures during resolution.
- Mark hooks as disabled for the session.
- Suppress Gastown built-in defaults if the failed source was runtime config.
- Emit one warning per failed source resolution event:
  - include source (`cli`, `env`, `claude_settings`),
  - include concise failure reason,
  - include resulting action: "hooks disabled for this session".

### 2. Logging guardrails
- Hook logs must include:
  - event name,
  - command identity,
  - duration,
  - exit code,
  - decision/reason when parsed.
- Redaction:
  - remove or mask common secrets (tokens, API keys, bearer strings).
  - never log full env blobs.
  - strict redaction applies in all verbosity levels.
- Truncation:
  - cap stdout/stderr log payload length to bounded size.
  - default limit is 2000 characters per stream.
  - mark truncation explicitly.
- Verbosity:
  - normal mode: concise status + warnings/errors.
  - verbose mode: structured execution details with redaction/truncation still enforced.
  - redaction should not create extra warning noise in normal mode; verbose output may include metadata like `redacted: true` and `truncated: true`.

### 3. Determinism + compatibility
- Existing precedence remains unchanged.
- Successful runtime config still overrides built-ins.
- Sessions never crash from hook-config parse errors.
- Existing hook behavior unchanged for valid config paths.

## Acceptance criteria
- Invalid `--hooks-config` path/JSON/schema:
  - session starts,
  - hooks disabled,
  - built-ins not run,
  - user warning displayed.
- Invalid `PI_HOOKS_JSON`:
  - same behavior as above.
- Logging output never emits unredacted secret-like values in tested fixtures.
- Long hook output is truncated with explicit marker.
- Existing hook tests continue to pass.

## Test plan
- Unit:
  - resolver returns disabled-hooks state for invalid runtime config.
  - runtime source failure does not fall through to built-ins.
  - redaction helper masks known secret patterns.
  - truncation helper bounds output and annotates truncation.
- Integration:
  - startup warning appears for invalid CLI/env config.
  - gastown-mode + invalid runtime config does not execute built-ins.
  - verbose logging includes structured fields with guardrails intact.

## Rollout notes
- Default behavior change is only for invalid runtime config sessions.
- Document in coding-agent README and hooks docs.
