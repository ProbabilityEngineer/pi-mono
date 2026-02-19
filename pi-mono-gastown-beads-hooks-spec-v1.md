# Codex Tasking Spec — pi-mono as Gastown+Beads Harness (Hooks Compatibility)

## Goal
Implement the minimum changes in **pi-mono** so it can be used as the **Gastown harness** (replacing Claude Code) while supporting **Beads** automation that Gastown relies on.

We will implement **Option B now** (pi-mono built-in Gastown defaults) in a way that cleanly upgrades to **Option A later** (Gastown passes explicit hook config) without refactoring core logic.

## Non-goals
- Do not require Claude Code to be installed.
- Do not require `.claude/settings*.json` to exist (optional future compatibility only).
- Do not fork Gastown in v1 (except later minimal change to pass config in Option A).

## Compatibility target
### Beads (minimum)
Beads’ Claude integration uses two lifecycle hooks:
- **SessionStart → `bd prime`**
- **PreCompact → `bd sync`**
(We must ensure these run in the pi-mono lifecycle when in gastown-mode.)

### Gastown (minimum)
Gastown’s automation expects Claude-hook-style lifecycle semantics:
- SessionStart
- PreToolUse (blocking; exit code 2 blocks)
- PostToolUse
- PreCompact

Gastown uses Beads, so both must work.

## Design decision
### Implement one HookRunner in pi-mono core
- Single internal hook runner that supports the four events above.
- Unified config model with strict source precedence.
- Option B is just a built-in config source that is activated only when pi-mono is launched in gastown-mode.

### Config source precedence (highest wins)
1) CLI: `--hooks-config <path>`
2) Env: `PI_HOOKS_JSON` (JSON string)
3) (optional future) `.claude/settings*.json` loader (off by default unless explicitly enabled)
4) Built-in defaults when `--gastown` or `PI_GASTOWN_MODE=1` (Option B fallback)

When Option A is implemented in Gastown, Gastown will always provide (1) or (2), automatically overriding Option B.

## Required core behaviors
### Event mapping
Hook events in pi-mono must run deterministically relative to tool execution and compaction:

- **SessionStart**
  - Run once per session (or once per new transcript/session file).
  - Collect stdout (non-JSON or JSON “additionalContext”) and inject into the agent system prompt context on subsequent turns.

- **PreToolUse**
  - Run before tool executes.
  - Support matchers at minimum by tool name (e.g., “Bash”, “Write”).
  - Support blocking semantics:
    - Exit code 2 => BLOCK tool call with reason (stderr/stdout)
    - Exit code 0 => allow
    - Other nonzero => treat as hook failure; default fail-open (configurable)

- **PostToolUse**
  - Run after tool completes.
  - Append hook output as additional context (system-side annotation or tool-result note).

- **PreCompact**
  - Run before compaction.
  - Must reliably run `bd sync` in gastown-mode.

### Command execution contract
- Execute commands via shell (`/bin/sh -lc` on unix).
- Provide JSON payload on stdin with these minimal fields:
  - `hook_event_name`
  - `cwd`
  - For tool hooks: `tool_name`, `tool_input`, `tool_use_id`
- Timeout defaults to 5s (configurable per hook).
- Capture stdout/stderr (cap size; truncate safely).
- Never crash the session due to hook failure.

### Option B built-in defaults (activated only in gastown-mode)
Built-in defaults must be minimal and robust:

- SessionStart: run `gt prime` (preferred)
  - If `gt` missing, skip.
- PreCompact: run `bd sync`
  - If `bd` missing, skip.
- PreToolUse: run `gt tap guard` (blocking via exit 2)
  - If `gt` missing, skip.
- PostToolUse: optional (only if needed) `gt tap audit` or `gt tap check` (leave disabled in v1 unless required)

### Future: tool input mutation
Not required for v1 if not used, but design should allow later:
- Add optional `updatedInput` to PreToolUse hook JSON output.
- Apply updated input before tool execution.
(Implement as a separate slice if time is tight.)

## Implementation constraints
- Do not break existing pi-mono extension system; HookRunner is additive.
- Hooks must only run when explicitly configured OR gastown-mode enabled.
- No dependency on Claude Code binaries.

## Testing requirements
### Unit tests
- Config precedence resolution.
- Hook command runner:
  - timeout behavior
  - stdout/stderr capture and truncation
  - exit-code blocking for PreToolUse (exit 2 blocks)
- Event sequencing:
  - PreToolUse runs before tool
  - PostToolUse runs after tool
  - PreCompact runs before compaction
  - SessionStart runs once

### Integration tests
- Fake hook scripts:
  - SessionStart prints “context”; verify injected into system prompt.
  - PreToolUse exit 2 blocks a tool call.
  - PreCompact runs `bd sync` stub before compaction.

## Risks and mitigations
- Risk: executing local commands is dangerous.
  - Mitigation: opt-in only; gastown-mode explicit; document clearly.
- Risk: PATH assumptions (`gt`, `bd`).
  - Mitigation: detect missing command; skip hook; log in verbose mode.
- Risk: ordering bugs causing prompt injection too late.
  - Mitigation: deterministic single injection point with tests.

---

# Deliverables
1) HookRunner core module + config resolver + exec runner
2) Gastown-mode flag + built-in defaults (Option B)
3) PreToolUse blocking semantics (exit 2) implemented
4) Tests (unit + integration)
5) Documentation update (how to use with Gastown)

Option A readiness:
- Add support for `--hooks-config` and `PI_HOOKS_JSON` now, even if Gastown doesn’t emit yet.
- Later Gastown change will simply pass config (no pi-mono refactor).