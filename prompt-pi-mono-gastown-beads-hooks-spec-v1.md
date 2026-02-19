CODEX PROMPT (paste into Codex)

You are implementing pi-mono changes to make it a Gastown + Beads harness replacement for Claude Code, without requiring Claude Code installed.

Use the attached spec “Codex Tasking Spec — pi-mono as Gastown+Beads Harness (Hooks Compatibility)”.

Your job: divide the project into epics and slices, each slice independently shippable, with explicit acceptance criteria and tests. Prefer minimal v1 with Option B now (built-in defaults under gastown-mode) while designing config ingestion so Option A (Gastown passes hooks config) can be added later without refactor.

WORKFLOW REQUIREMENTS (MANDATORY):
- Create **one git branch per epic** (name it `epic/<short-kebab-name>`).
- Within each epic branch, implement **one slice per commit**.
- Commit messages must be structured: `slice: <short description>` and reference the epic and slice ID in the body.
- Keep commits small and reviewable; do not mix slices in a single commit.
- When an epic is complete, open a PR back to `main` (or prepare a merge plan if PRs aren’t used).

Constraints:
- pi-mono must continue supporting all model providers it currently supports; hooks layer is additive and only enabled when configured or gastown-mode is enabled.
- Do NOT depend on Claude Code being installed.
- Do NOT require `.claude/settings*.json` to exist.
- Implement config precedence:
  1) --hooks-config path
  2) PI_HOOKS_JSON env
  3) (optional future) .claude loader
  4) built-in defaults when gastown-mode enabled
- Implement hook events: SessionStart, PreToolUse (exit code 2 blocks), PostToolUse, PreCompact.
- Option B built-in defaults in gastown-mode:
  - SessionStart: `gt prime` (skip if gt missing)
  - PreCompact: `bd sync` (skip if bd missing)
  - PreToolUse: `gt tap guard` (skip if gt missing)
  - PostToolUse: omit in v1 unless clearly required
- Command execution: shell `/bin/sh -lc`, JSON stdin payload minimal fields, timeout default 5s, safe capture/truncation, never crash session on hook failure.
- Testing: unit tests for config precedence + runner + exit-code blocking; integration tests with stub scripts verifying event ordering and prompt injection.

Output format:
1) Epics list (3–6 epics max).
2) Under each epic: slices (smallest practical units), each with:
   - goal
   - branch name (for the epic)
   - commit plan (one commit per slice)
   - files/modules likely touched (best guess)
   - acceptance criteria (explicit)
   - tests (unit/integration)
   - risks and mitigations (if any)

Be decisive. Keep scope tight for v1; mark “future” slices explicitly.