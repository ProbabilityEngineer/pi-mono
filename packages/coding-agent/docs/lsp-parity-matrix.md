# LSP Parity Matrix

Reference baseline:
- `59451f71` feat(coding-agent): merge typescript lsp tuning from oh-my-pi
- `214e74f6` feat(coding-agent): backport oh-my-pi lsp defaults and detection
- `622fdf20` feat(coding-agent): improve lsp guidance and symbol filtering

Legend:
- `match`: behavior/configuration is aligned with the Oh-My-Pi parity target
- `diff`: known mismatch that needs follow-up
- `intended divergence`: deliberate and documented difference

| Language ID | Parity Status | Notes |
| --- | --- | --- |
| `astro` | `match` | Default server coverage preserved (`astro`). |
| `csharp` | `match` | Default server coverage preserved (`omnisharp`). |
| `css` | `match` | Default server coverage preserved (`vscode-css-language-server`). |
| `dart` | `match` | Default server coverage preserved (`dartls`). |
| `dockerfile` | `match` | Default server coverage preserved (`dockerls`). |
| `elixir` | `match` | Default server coverage preserved (`elixirls`). |
| `erlang` | `match` | Default server coverage preserved (`erlangls`). |
| `gleam` | `match` | Default server coverage preserved (`gleam`). |
| `go` | `match` | Default server coverage preserved (`gopls`). |
| `graphql` | `match` | Default server coverage preserved (`graphql`). |
| `haskell` | `match` | Default server coverage preserved (`hls`). |
| `helm` | `match` | Default server coverage preserved (`helm-ls`). |
| `html` | `match` | Default server coverage preserved (`vscode-html-language-server`). |
| `java` | `match` | Default server coverage preserved (`jdtls`). |
| `javascript` | `match` | Default server coverage preserved (`typescript-language-server` + linter roles). |
| `javascriptreact` | `match` | Default server coverage preserved (`typescript-language-server` + linter roles). |
| `json` | `match` | Default server coverage preserved (`vscode-json-language-server`). |
| `jsonc` | `match` | Default server coverage preserved (`vscode-json-language-server`). |
| `kotlin` | `match` | Default server coverage preserved (`kotlin-language-server`). |
| `less` | `match` | Default server coverage preserved (`vscode-css-language-server`). |
| `lua` | `match` | Default server coverage preserved (`lua-language-server`). |
| `markdown` | `match` | Default server coverage preserved (`marksman`). |
| `nix` | `match` | Default server coverage preserved (`nixd`, `nil`). |
| `ocaml` | `match` | Default server coverage preserved (`ocamllsp`). |
| `odin` | `match` | Default server coverage preserved (`ols`). |
| `php` | `match` | Default server coverage preserved (`intelephense`, `phpactor`). |
| `prisma` | `match` | Default server coverage preserved (`prismals`). |
| `python` | `match` | Default server coverage preserved (`pyright`, `basedpyright`, `pylsp`, `ruff`). |
| `ruby` | `match` | Default server coverage preserved (`solargraph`, `ruby-lsp`, `rubocop`). |
| `rust` | `match` | Default server coverage preserved (`rust-analyzer`). |
| `sass` | `match` | Default server coverage preserved (`vscode-css-language-server`). |
| `scala` | `match` | Default server coverage preserved (`metals`). |
| `scss` | `match` | Default server coverage preserved (`vscode-css-language-server`). |
| `shell` | `match` | Default server coverage preserved (`bashls`). |
| `svelte` | `match` | Default server coverage preserved (`svelte`). |
| `swift` | `match` | Default server coverage preserved (`sourcekit-lsp`, `swiftlint`). |
| `terraform` | `match` | Default server coverage preserved (`terraformls`). |
| `tex` | `match` | Default server coverage preserved (`texlab`). |
| `toml` | `match` | Default server coverage preserved (`taplo`). |
| `typescript` | `match` | TypeScript initOptions parity retained plus linter-role handling. |
| `typescriptreact` | `match` | TypeScript initOptions parity retained plus linter-role handling. |
| `vim` | `match` | Default server coverage preserved (`vimls`). |
| `vue` | `match` | Default server coverage preserved (`vue-language-server`). |
| `yaml` | `match` | Default server coverage preserved (`yamlls`, `helm-ls`). |
