# LSP Backport Handoff (2026-02-18)

## Status
- Hashline backport is complete and merged to `main`.
- LSP implementation is not yet started in `pi-mono`.
- Tracking issue: `pi-mono-czb` (`in_progress`) with child tasks:
  - `pi-mono-czb.1` settings model
  - `pi-mono-czb.2` language detector + planner
  - `pi-mono-czb.3` auto-installer
  - `pi-mono-czb.4` runtime integration
  - `pi-mono-czb.5` UX/docs/tests

## What Is Already Captured In Beads
- Parent issue includes full objective and acceptance criteria.
- Parent + child comments now include:
  - exact source files in `oh-my-pi`
  - target files in `pi-mono`
  - install strategy requirements
  - runtime hook points
  - minimum test matrix and quality gate

## Architecture Reality Check
- `oh-my-pi` has full LSP stack at `packages/coding-agent/src/lsp/*`.
- `pi-mono` currently has no `packages/coding-agent/src/lsp/`.
- `pi-mono` tool stack lives in `packages/coding-agent/src/core/tools/*`, not `src/tools/*`.
- Backport is not a straight file copy; it needs adapter work into `core/*` layout.

## Required Source Set From oh-my-pi
- `packages/coding-agent/src/lsp/client.ts`
- `packages/coding-agent/src/lsp/clients/index.ts`
- `packages/coding-agent/src/lsp/clients/lsp-linter-client.ts`
- `packages/coding-agent/src/lsp/clients/biome-client.ts`
- `packages/coding-agent/src/lsp/clients/swiftlint-client.ts`
- `packages/coding-agent/src/lsp/config.ts`
- `packages/coding-agent/src/lsp/defaults.json`
- `packages/coding-agent/src/lsp/edits.ts`
- `packages/coding-agent/src/lsp/index.ts`
- `packages/coding-agent/src/lsp/lspmux.ts`
- `packages/coding-agent/src/lsp/render.ts`
- `packages/coding-agent/src/lsp/types.ts`
- `packages/coding-agent/src/lsp/utils.ts`
- `packages/coding-agent/src/prompts/tools/lsp.md`

## Target Integration Points In pi-mono
- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/src/core/tools/index.ts`
- `packages/coding-agent/src/core/tools/read.ts`
- `packages/coding-agent/src/core/tools/edit.ts`
- `packages/coding-agent/src/core/tools/write.ts`
- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/sdk.ts`
- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/src/main.ts`
- `packages/coding-agent/test/*` (new + updated tests)

## LSP Behavior Spec To Implement
1. New repos default to language LSP disabled.
2. Encountering a language file can trigger planner:
   - `none`
   - `enable_only`
   - `install_then_enable`
3. Auto-install and auto-enable are setting-controlled.
4. Install failures produce actionable remediation and do not silently pass.
5. Successful enablement persists in project settings.

## Suggested New Settings Shape (pi-mono)
- `lsp.enabled` (global master toggle)
- `lsp.autoEnableOnEncounter` (default `true`)
- `lsp.autoInstallOnEncounter` (default `true`)
- `lsp.languages` as per-project map (default empty = all disabled)

## Execution Order
1. Do `czb.1` first (settings + persistence + migration-safe defaults).
2. Do `czb.2` (detector + planner from `defaults.json` + config overrides).
3. Do `czb.3` (installer abstraction + executable verification + remediation).
4. Do `czb.4` (wire encounter hooks into `read/edit/write` via session coordinator).
5. Do `czb.5` (tests/docs/help text + final `npm run check`).

## Startup Prompt For New Agent (copy/paste)
```text
You are working in /Users/sam/Documents/GitHub/pi-backport/pi-mono.

Goal:
Implement LSP backport from oh-my-pi into pi-mono with lazy auto-install + auto-enable on language encounter, while keeping new repos language-disabled by default.

Rules:
- Do not modify oh-my-pi.
- Work only in pi-mono on a new branch.
- Use beads for tracking.
- Keep commits focused and incremental.

First actions:
1) git checkout -b feature/lsp-lazy-enable
2) bd show pi-mono-czb
3) bd update pi-mono-czb.1 --status in_progress
4) Read comments on pi-mono-czb and pi-mono-czb.1-.5 for the exact implementation spec.

Implementation plan:
- Port `packages/coding-agent/src/lsp/*` and `prompts/tools/lsp.md` from oh-my-pi into pi-mono, adapting imports/paths to pi-mono's `src/core/*` architecture.
- Add LSP settings model in `src/core/settings-manager.ts`:
  - lsp.enabled
  - lsp.autoEnableOnEncounter
  - lsp.autoInstallOnEncounter
  - lsp.languages (per-project map)
- Add language detector + planner based on file extension and lsp defaults.
- Add installer service that verifies binary presence and runs install commands where supported.
- Hook language encounter into `read/edit/write` flow via `src/core/agent-session.ts` coordinator.
- Persist language enablement in project settings on successful install/enable.
- Add tests for defaults, planner, installer outcomes, and encounter flow.

Quality gate:
- Run npm run check.

When done:
- Update beads statuses and notes.
- Write HANDOFF_lsp_backport_<date>.md with what shipped, what remains, and exact commands/results.
```

## Open Implementation Risks
- Installer portability (npm/pip/cargo/homebrew differences) should return remediation when unsupported.
- Avoid repeated install attempts in one session for same language/server.
- Keep migration behavior safe for existing user settings with no `lsp` object.
