# Starter Prompt: Hashline + LSP Parity (Oh-My-Pi -> pi-mono)

Use this as the first prompt in a new session:

---
Resume parity work for `packages/coding-agent` from `oh-my-pi` with beads-driven execution.

Goals:
1. Complete LSP parity slices:
- `pi-mono-3b1.1` config fields parity (`rootMarkers`, `initOptions`, `settings`, `isLinter`)
- `pi-mono-3b1.3` linter-server role handling
- `pi-mono-3b1.4` status/reload actions parity
- `pi-mono-3b1.5` config discovery paths/formats parity
2. Complete hashline parity audit slice:
- `pi-mono-2cp.1`
3. Preserve and validate per-language tuning parity coverage.

Requirements:
- Use `bd ready`, then mark selected bead `in_progress`.
- Use one branch per epic (group all `pi-mono-3b1.*` slices on one branch, and `pi-mono-2cp.*` on another).
- Work slice-by-slice; commit after each slice passes tests/checks.
- Run `npm run check` after code changes.
- Do not stage unrelated files; use explicit `git add <paths>`.
- Keep compatibility behavior unless a bead explicitly changes it.

Language tuning parity must cover these language IDs:
`astro, csharp, css, dart, dockerfile, elixir, erlang, gleam, go, graphql, haskell, helm, html, java, javascript, javascriptreact, json, jsonc, kotlin, less, lua, markdown, nix, ocaml, odin, php, prisma, python, ruby, rust, sass, scala, scss, shell, svelte, swift, terraform, tex, toml, typescript, typescriptreact, vim, vue, yaml`

Current baseline commits to keep in context:
- `59451f71` feat(coding-agent): merge typescript lsp tuning from oh-my-pi
- `214e74f6` feat(coding-agent): backport oh-my-pi lsp defaults and detection
- `622fdf20` feat(coding-agent): improve lsp guidance and symbol filtering

Deliverables:
- Updated code for each completed slice
- Passing `npm run check`
- Beads updated (`closed` for completed slices, new follow-ups if needed)
- Clean commit history with one commit per slice
---
