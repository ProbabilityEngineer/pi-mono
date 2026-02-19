# Upstream Externalization Branch Plan (pi-mono-737)

## Dependency Graph

```text
Layer 0 (parallel)
- pi-mono-737.1 Extract /freemodel into extension command + UI
- pi-mono-737.2 Move LSP/ast-grep policy text to skills/prompt templates
- pi-mono-737.3 Separate process/planning docs from merge-critical branch

Layer 1
- pi-mono-737.4 Create upstream-sync checkpoint after extractions
  depends on: 737.1, 737.2, 737.3

Layer 2 (parallel)
- pi-mono-737.5 Isolate hooks engine as core-only patch stack
- pi-mono-737.6 Isolate hashline tooling as core-only patch stack
- pi-mono-737.7 Isolate LSP subsystem as core-only patch stack
  all depend on: 737.4
```

## Branch Mapping

- `epic/737-1-freemodel-extension-ui` -> `pi-mono-737.1`
- `epic/737-2-policy-to-skills-prompts` -> `pi-mono-737.2`
- `epic/737-3-docs-process-separation` -> `pi-mono-737.3`
- `epic/737-4-upstream-sync-checkpoint` -> `pi-mono-737.4`
- `epic/737-5-core-hooks-stack` -> `pi-mono-737.5`
- `epic/737-6-core-hashline-stack` -> `pi-mono-737.6`
- `epic/737-7-core-lsp-stack` -> `pi-mono-737.7`

## Commit Slice Plan

- Slice A: graph + branch map doc (this file)
- Slice B: 737.1 implementation commits on `epic/737-1-freemodel-extension-ui`
- Slice C: 737.2 implementation commits on `epic/737-2-policy-to-skills-prompts`
- Slice D: 737.3 doc/process cleanup commits on `epic/737-3-docs-process-separation`
- Slice E: upstream sync checkpoint commits on `epic/737-4-upstream-sync-checkpoint`
- Slice F/G/H: isolated core patch stacks on 737.5/737.6/737.7 branches

## Checkpoint Output

- `docs/ops/upstream-sync-checkpoint-2026-02-19.md`
