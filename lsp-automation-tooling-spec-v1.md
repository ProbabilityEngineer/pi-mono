# pi-mono LSP + ast-grep Workflow Spec v1

## Status
Draft for implementation planning.

## Purpose
Define how pi-mono should balance LSP, structural refactoring tools (for example `ast-grep`), and pre-commit checks so model workflows stay fast and reliable.

## Problem statement
Feedback raised:
- "LSP should be a pre-commit-only concern."
- "LSP interrupts the model while editing."
- "`ast-grep` should be preferred for speed."

This spec clarifies that each layer has a different job and should not replace the others.

## Critique assessment
The critique has partial merit:
- valid: pre-commit is the right final gate.
- valid: excessive in-loop diagnostics can add noise/latency.
- valid: structural tools can outperform semantic tooling for broad codemods.

But it is incomplete:
- pre-commit-only misses in-loop semantic assistance.
- semantic safety (rename/references/type intent) is not replaced by structural matching.
- best results come from layering tools by role rather than choosing one.

## Decision summary
- Keep LSP support in pi-mono.
- Keep pre-commit checks as final enforcement.
- Treat `ast-grep` as a complementary structural tool, not a semantic replacement for LSP.
- Make capability availability explicit to avoid wasted tool attempts.
- Keep LSP assistive/non-blocking by default.

## Scope
- Prompt/system-guidance content for tool choice.
- Capability signaling in startup/runtime context.
- Settings and behavior guidance for LSP encounter automation.
- Documentation updates for user/operator understanding.

## Non-goals
- Replacing LSP with `ast-grep`.
- Making LSP a mandatory blocking gate on every edit.
- Introducing a new permission UI.

## Role boundaries
### LSP
- Semantic navigation and safety: definition, references, rename confidence, diagnostics.
- Used during editing when helpful; not required on every step.

### ast-grep (or equivalent structural search/replace tools)
- Fast syntactic/structural bulk rewrites and matching.
- Best for large codemods and repetitive structural transforms.

### Pre-commit checks
- Final enforcement and repository policy gate.
- Catches remaining issues before changes are committed.

## Default behavior policy
- LSP remains available and default-enabled where configured today.
- Encounter automation remains default-on unless explicitly disabled:
  - `lsp.autoEnableOnEncounter = true`
  - `lsp.autoInstallOnEncounter = true`
- LSP should not hard-stop model flow by default.

## Capability signaling requirements
- Surface tool/runtime capability state early so the model can choose tools correctly:
  - LSP enabled/disabled
  - per-language LSP server installed/missing/auto-installable
  - `ast-grep` available/unavailable
- Signals should be concise and deterministic.

## Prompt guidance requirements
- Add lightweight guidance (not hard requirements):
  - Prefer LSP for semantic tasks.
  - Prefer `ast-grep` for bulk structural rewrites when available.
  - Use pre-commit checks as final validation.
- Guidance must not assume `ast-grep` exists unless availability is confirmed.

## Terminology and planning units
- Use `epic` for multi-slice initiatives.
- Use `task` and `subtask` in beads for trackable work items.
- Use `slice` for the smallest independently shippable implementation unit.
- Commit convention:
  - one slice per commit
  - merge commit closes epic branch

## Acceptance criteria
- Docs clearly explain LSP vs `ast-grep` vs pre-commit roles.
- Startup/runtime context includes deterministic capability signaling fields.
- System/prompt guidance reflects tool-role policy without over-constraining behavior.
- No regression to current LSP default-on encounter behavior.
- Existing checks/tests continue to pass.

## Rollout order
1. Docs and policy framing
2. Capability signaling
3. Prompt guidance wiring
4. Validation and regression coverage
