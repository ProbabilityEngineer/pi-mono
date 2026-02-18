# Handoff: Hashline + LSP Parity from Oh-My-Pi

## Status
- Yes: the active parity roadmap is tracked in beads.
- Open parity epics/tasks:
  - `pi-mono-2cp` (epic) Phase 2: Hashline parity audit/backport
  - `pi-mono-2cp.1` Hashline delta audit + minimal safe backports
  - `pi-mono-3b1` (epic) Phase 2: LSP parity backport
  - `pi-mono-3b1.1` LSP server config fields parity (`rootMarkers/initOptions/settings/isLinter`)
  - `pi-mono-3b1.3` Linter-server role handling parity
  - `pi-mono-3b1.4` LSP status/reload action parity
  - `pi-mono-3b1.5` LSP config discovery paths/formats parity
- Completed parity slice:
  - `pi-mono-3b1.2` TypeScript LSP fine tuning merge

## Current Git Context
- Active branch: `slice-lsp-typescript-tuning`
- Recent relevant commits:
  - `59451f71` feat(coding-agent): merge typescript lsp tuning from oh-my-pi
  - `214e74f6` feat(coding-agent): backport oh-my-pi lsp defaults and detection
  - `622fdf20` feat(coding-agent): improve lsp guidance and symbol filtering

## LSP Language Coverage (current defaults.json)
`astro, csharp, css, dart, dockerfile, elixir, erlang, gleam, go, graphql, haskell, helm, html, java, javascript, javascriptreact, json, jsonc, kotlin, less, lua, markdown, nix, ocaml, odin, php, prisma, python, ruby, rust, sass, scala, scss, shell, svelte, swift, terraform, tex, toml, typescript, typescriptreact, vim, vue, yaml`

Count: `44`

## What To Do Next
1. Execute remaining open LSP slices (`3b1.1`, `3b1.3`, `3b1.4`, `3b1.5`) with tests per slice.
2. Execute hashline parity audit slice (`2cp.1`) and create implementation follow-up beads if needed.
3. Use one branch per epic (for example, one branch for `pi-mono-3b1*`, one branch for `pi-mono-2cp*`).
4. Keep TypeScript tuning as merged baseline; only adjust if conflicts with broader server config parity.
5. Run `npm run check` after code changes.
6. Commit per slice after checks pass; stage only touched files.

## Risks / Watchpoints
- Preserve backward compatibility in LSP config loading.
- Avoid changing edit behavior unless explicitly part of hashline parity scope.
- Keep linter-role servers additive (do not displace primary semantic server unintentionally).
