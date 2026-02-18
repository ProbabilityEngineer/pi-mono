# LSP Lazy Enable Handoff (2026-02-18)

## Status
- Branch: `feature/lsp-lazy-enable`
- Remote tracking branch: `fork/feature/lsp-lazy-enable`
- Beads:
  - `pi-mono-czb.1` closed
  - `pi-mono-czb.2` closed
  - `pi-mono-czb.3` closed
  - `pi-mono-czb.4` closed
  - `pi-mono-czb.5` closed
  - `pi-mono-czb` closed

## Decisions Taken
1. Install scope: project-local-first behavior (local bin resolution first, then PATH checks).
2. V1 language/server set: TypeScript, JSON/CSS/HTML, Python, plus Rust/Go mapping with remediation-only installer entries.
3. Auto-install policy: no interactive prompt; automatic when enabled by settings, with actionable remediation surfaced in tool output.

## Implemented
- Added LSP settings model and persistence API in `packages/coding-agent/src/core/settings-manager.ts`:
  - `lsp.enabled` (default `true`)
  - `lsp.autoEnableOnEncounter` (default `true`)
  - `lsp.autoInstallOnEncounter` (default `true`)
  - `lsp.languages` project map (default empty = language-disabled by default for new repos)
- Added LSP module under `packages/coding-agent/src/lsp/`:
  - `defaults.json`
  - `types.ts`
  - `detection.ts`
  - `config.ts`
  - `planner.ts`
  - `installer.ts`
  - `encounter.ts`
  - `index.ts`
- Added runtime encounter hook integration:
  - `read`/`edit`/`write` now accept `onPathAccess` callback options and append LSP status/remediation notes when returned.
  - `AgentSession` now creates a language-encounter coordinator and wires callbacks via `createAllTools(...)`.
  - Session-level attempt suppression prevents repeated install attempts for the same language/server pair.
- Updated docs:
  - `packages/coding-agent/docs/settings.md`
  - `packages/coding-agent/README.md`
  - `packages/coding-agent/CHANGELOG.md` (`[Unreleased]`)

## Tests Added/Updated
- `packages/coding-agent/test/settings-manager.test.ts` (LSP defaults + persistence + reload)
- `packages/coding-agent/test/lsp-planner.test.ts`
- `packages/coding-agent/test/lsp-installer.test.ts`
- `packages/coding-agent/test/lsp-encounter.test.ts`
- `packages/coding-agent/test/tools.test.ts` (LSP note propagation in tool outputs)

## Validation
- Ran from repo root: `npm run check`
- Result: passed (Biome + typecheck + web-ui checks)

## Execution Policy (Clarified)
- Do all remaining follow-up work on `feature/lsp-lazy-enable` (or child branches from it), not on `main`.
- Complete exactly one bead child slice at a time.
- After each slice:
  - run `npm run check`
  - commit that slice only
  - push branch update to `fork`
- Do not merge to `main` during slice execution sessions.

## Notes / Follow-up Candidates
- Current v1 does not backport full LSP request/response tooling (`lsp` tool operations like hover/definition/refs); this work focuses on lazy install/enable plumbing and encounter automation.
- Windows executable probing currently relies on PATH file existence checks; if stricter executable validation is needed, add explicit spawn-based probing.

## Follow-up Beads Created

### Full LSP Tooling Backport
- Parent: `pi-mono-4rc`
- Children:
  - `pi-mono-4rc.1` LSP core transport + client lifecycle backport
  - `pi-mono-4rc.2` LSP tool API: hover/definition/references/symbols
  - `pi-mono-4rc.5` LSP edits + diagnostics integration
  - `pi-mono-4rc.3` LSP runtime wiring + prompt/tool registration
  - `pi-mono-4rc.4` LSP full-surface tests + docs

### Windows Executable Validation Hardening
- Parent: `pi-mono-1wa`
- Children:
  - `pi-mono-1wa.2` Define cross-platform command probe contract
  - `pi-mono-1wa.1` Implement Windows-specific executable resolution + probe
  - `pi-mono-1wa.3` Integrate probe into LSP planner/installer gating
  - `pi-mono-1wa.4` Windows probe test matrix + remediation docs

## Starter Prompt (Revised)
```text
You are working in /Users/sam/Documents/GitHub/pi-backport/pi-mono on branch feature/lsp-lazy-enable.

Context:
- Lazy LSP encounter install/enable backport is already shipped.
- Follow-up work is tracked in:
  - pi-mono-4rc (full LSP tooling backport)
  - pi-mono-1wa (Windows executable validation hardening)

Execution policy:
1) Work one child slice at a time.
2) After each slice:
   - run npm run check
   - commit only that slice
   - push to fork/feature/lsp-lazy-enable
3) Do not merge to main in-session.

First actions:
1) bd show pi-mono-4rc
2) bd update pi-mono-4rc.1 --status in_progress
3) Implement only pi-mono-4rc.1 scope.
4) Run npm run check, commit, push to fork.
5) Close pi-mono-4rc.1 and move to next child.
```
