# pi-mono Gastown + Beads Hooks — Spec v1.1 (Delta)

## Status
Delta to v1. This document only describes additions and refinements.  
All behavior defined in v1 remains unchanged unless explicitly noted.

Implementation snapshot (as of 2026-02-19):
- Completed:
  - Runtime hook config ingestion + precedence
  - Invalid runtime-config handling (disable hooks for session, no crash, no fallback to built-ins)
  - Logging guardrails (redaction + truncation + deterministic fields)
- Pending:
  - Structured JSON decision parsing from hook stdout (`decision`, `reason`, `additionalContext`)
  - `updatedInput` tool argument mutation
  - Structured hook-context injection pipeline beyond current raw output fallback

## Purpose
v1.1 introduces runtime configurability and structured hook decisions so pi-mono can accept hook configuration directly from Gastown (Option A) while maintaining the v1 fallback defaults.

---

## Changes in v1.1

### 1. Runtime hook configuration ingestion (Option A)

pi-mono MUST support receiving hook configuration at runtime.

#### Supported inputs (precedence order — highest wins)
1. `--hooks-config <path>` CLI flag
2. `PI_HOOKS_JSON` environment variable (JSON blob)
3. Built-in defaults (v1 fallback, only when gastown-mode enabled)

`.claude/settings*.json` support remains optional and OFF by default.

#### Behavior
- If runtime config is provided, built-in defaults MUST NOT execute.
- Config must be validated at startup.
- If runtime config is present but invalid, pi MUST:
  - log a structured error (source + parse/validation failure reason),
  - disable hooks for the session,
  - NOT execute built-in defaults for that session.
- If no runtime config is present and gastown-mode is enabled, built-in defaults execute (v1 behavior).

Status: DONE (2026-02-19)

---

### 2. Structured hook decision parsing

PreToolUse and PostToolUse hooks MAY return JSON on stdout.

#### Supported fields

```
{
  "decision": "allow | deny | ask",
  "reason": "string",
  "additionalContext": "string"
}
```

#### Behavior
- `deny` MUST block tool execution.
- `allow` proceeds normally.
- `ask` is treated as allow in v1.1 (no permission UI).
- `reason` should be surfaced in logs and tool error message.
- `additionalContext` should be injected into hook context for the next model turn.
- `ask` should emit a warning-level log entry indicating fallback-to-allow.

Exit code semantics from v1 remain valid (exit code 2 still blocks).

Status: PENDING

---

### 3. Tool input mutation (`updatedInput`)

PreToolUse hooks MAY return:

```
{
  "updatedInput": { ... }
}
```

#### Behavior
- Merge updatedInput into tool arguments before execution.
- Shallow merge is sufficient for v1.1.
- Invalid JSON should be ignored with warning.
- Guardrails:
  - mutation is limited to tool argument payload,
  - tool name and tool call ID are immutable,
  - keys named `__proto__`, `prototype`, and `constructor` must be ignored.

Status: PENDING

---

### 4. Improved context injection

Hook output should support structured injection instead of raw stdout concatenation.

#### Behavior
- Prefer `additionalContext` field when present.
- Raw stdout fallback remains for backward compatibility.
- Injection target and ordering:
  - context is attached as a dedicated hook-context block,
  - delivery occurs on the next model prompt assembly,
  - multiple injections in one turn are concatenated in hook execution order.

Status: PENDING

---

### 5. Logging improvements

Hook execution logs should include:
- event name
- command
- duration
- exit code
- decision (if parsed)
- reason (if present)
- config source (cli/env/default)

Logging level should respect existing verbosity settings.
Logs should avoid leaking sensitive payloads and should truncate long stdout/stderr content.
Guardrail defaults for v1.1:
- strict redaction is always enabled (all log levels),
- stdout/stderr log capture is capped at 2000 characters each,
- redaction does not emit extra warnings in normal mode,
- verbose mode may include metadata flagging redaction/truncation (for diagnostics).

Status: MOSTLY DONE (2026-02-19)
- Implemented: config source, duration, exit code, decision/reason fields, strict redaction, 2000-char truncation, truncation/redaction metadata.
- Deferred with Section 2: decision/reason derived from parsed JSON stdout.

---

## Non-goals

- Permission UI
- Hook sandboxing
- Complex matcher DSL
- New lifecycle events
- Performance optimizations beyond basic logging

---

## Backward compatibility

v1 behavior MUST remain unchanged when runtime config is not provided.

Built-in defaults must still operate exactly as in v1 when gastown-mode is enabled and no runtime config is supplied.

---

## Acceptance criteria

- [x] pi-mono runs with runtime hook config supplied via CLI flag.
- [ ] PreToolUse JSON decision blocks tool execution correctly.
- [ ] updatedInput modifies tool arguments.
- [ ] additionalContext appears in model prompt context.
- [x] Built-in defaults do not run when runtime config present.
- [x] Existing v1 tests continue to pass.
- [x] Runtime config parse/validation failures disable hooks without crashing session.
- [ ] Hook context injection order is deterministic for multiple hooks in one turn.

---

## Migration notes

Gastown can begin passing hook config without requiring any further pi-mono changes after v1.1.
