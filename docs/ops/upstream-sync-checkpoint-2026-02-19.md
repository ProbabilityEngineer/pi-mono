# Upstream Sync Checkpoint (2026-02-19)

Issue: `pi-mono-737.4`

## Baseline

- Fork baseline checked: `main@29d785f6`
- Upstream baseline checked: `upstream/main@3a3e37d3`
- Extraction streams already landed before checkpoint:
  - `pi-mono-737.1`
  - `pi-mono-737.2`
  - `pi-mono-737.3`

## Upstream Integration Attempt

Command run on checkpoint branch:

```bash
git merge --no-commit --no-ff upstream/main
```

Result:
- Not clean.
- Merge conflict files:
  - `packages/coding-agent/CHANGELOG.md`

The merge attempt was aborted after conflict capture (`git merge --abort`).

## Residual Delta Snapshot

Compared with:

```bash
git diff --name-only upstream/main...HEAD
```

Commit-distance snapshot:
- `upstream/main` only: 7 commits
- fork `HEAD` only: 125 commits

## Residual Core-Only Candidate Groups

### 737.5 Hooks stack

- `packages/coding-agent/src/core/hooks/command-runner.ts`
- `packages/coding-agent/src/core/hooks/config-resolver.ts`
- `packages/coding-agent/src/core/hooks/config.ts`
- `packages/coding-agent/src/core/hooks/gastown-defaults.ts`
- `packages/coding-agent/src/core/hooks/index.ts`
- `packages/coding-agent/src/core/hooks/logging-guardrails.ts`
- `packages/coding-agent/src/core/hooks/runner.ts`
- `packages/coding-agent/src/core/hooks/startup-warning.ts`
- `packages/coding-agent/src/core/hooks/types.ts`
- `packages/coding-agent/test/hooks-command-runner.test.ts`
- `packages/coding-agent/test/hooks-config-resolver.test.ts`
- `packages/coding-agent/test/hooks-config.test.ts`
- `packages/coding-agent/test/hooks-gastown-defaults.test.ts`
- `packages/coding-agent/test/hooks-logging-guardrails.test.ts`
- `packages/coding-agent/test/hooks-precompact-order.test.ts`
- `packages/coding-agent/test/hooks-runner.test.ts`
- `packages/coding-agent/test/hooks-sessionstart-prompt.test.ts`
- `packages/coding-agent/test/hooks-startup-warning.test.ts`
- `packages/coding-agent/test/hooks-tool-lifecycle.test.ts`

### 737.6 Hashline stack

- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/tools/edit.ts`
- `packages/coding-agent/src/core/tools/grep.ts`
- `packages/coding-agent/src/core/tools/hashline.ts`
- `packages/coding-agent/src/core/tools/index.ts`
- `packages/coding-agent/src/core/tools/read.ts`
- `packages/coding-agent/src/core/tools/write.ts`
- `packages/coding-agent/src/modes/interactive/components/tool-execution.ts`
- `packages/coding-agent/test/agent-session-hashline-read-gating.test.ts`
- `packages/coding-agent/test/hashline-concurrency-stress.test.ts`
- `packages/coding-agent/test/tools.test.ts`

### 737.7 LSP stack

- `packages/coding-agent/src/cli/args.ts`
- `packages/coding-agent/src/core/settings-manager.ts`
- `packages/coding-agent/src/core/tools/lsp.ts`
- `packages/coding-agent/src/lsp/api.ts`
- `packages/coding-agent/src/lsp/client.ts`
- `packages/coding-agent/src/lsp/config.ts`
- `packages/coding-agent/src/lsp/defaults.json`
- `packages/coding-agent/src/lsp/detection.ts`
- `packages/coding-agent/src/lsp/edits.ts`
- `packages/coding-agent/src/lsp/encounter.ts`
- `packages/coding-agent/src/lsp/index.ts`
- `packages/coding-agent/src/lsp/installer.ts`
- `packages/coding-agent/src/lsp/lspmux.ts`
- `packages/coding-agent/src/lsp/planner.ts`
- `packages/coding-agent/src/lsp/probe.ts`
- `packages/coding-agent/src/lsp/render.ts`
- `packages/coding-agent/src/lsp/types.ts`
- `packages/coding-agent/src/modes/interactive/components/settings-selector.ts`
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/coding-agent/test/lsp-api-server-role.test.ts`
- `packages/coding-agent/test/lsp-api.test.ts`
- `packages/coding-agent/test/lsp-client.test.ts`
- `packages/coding-agent/test/lsp-config-discovery.test.ts`
- `packages/coding-agent/test/lsp-config-fields.test.ts`
- `packages/coding-agent/test/lsp-config-language-matrix.test.ts`
- `packages/coding-agent/test/lsp-config-priority.test.ts`
- `packages/coding-agent/test/lsp-config-ts-tuning.test.ts`
- `packages/coding-agent/test/lsp-config-windows.test.ts`
- `packages/coding-agent/test/lsp-encounter.test.ts`
- `packages/coding-agent/test/lsp-installer.test.ts`
- `packages/coding-agent/test/lsp-live-matrix.test.ts`
- `packages/coding-agent/test/lsp-lspmux.test.ts`
- `packages/coding-agent/test/lsp-planner.test.ts`
- `packages/coding-agent/test/lsp-probe.test.ts`
- `packages/coding-agent/test/lsp-runtime-wiring.test.ts`
- `packages/coding-agent/test/lsp-tool.test.ts`

### Cross-cutting (follow-up triage)

- `packages/coding-agent/src/core/extensions/wrapper.ts`
- `packages/coding-agent/src/core/index.ts`
- `packages/coding-agent/src/core/sdk.ts`
- `packages/coding-agent/src/core/slash-commands.ts`
- `packages/coding-agent/src/core/system-prompt.ts`
- `packages/coding-agent/src/index.ts`
- `packages/coding-agent/src/main.ts`
- `packages/coding-agent/src/modes/interactive/components/model-selector.ts`
