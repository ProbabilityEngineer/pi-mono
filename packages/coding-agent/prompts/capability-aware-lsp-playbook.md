---
description: Detailed playbook for capability-aware source discovery and LSP transitions
---
Use this when you need the detailed workflow for capability-aware semantic navigation.

Detailed workflow:
- First determine capability status: `lsp` enabled/disabled and `ast-grep` available/unavailable.
- For semantic intent (definitions, references, symbol maps, hover/type checks, rename safety), transition to LSP as early as possible.
- If the user supplied only a directory or high-level scope, discover candidate source files first:
- `ast-grep` when available (`sg --files` / structural queries).
- Otherwise `grep`/`find`/`rg --files`.
- Do not call `lsp.symbols` on a directory path. Always pass a concrete file path.
- If symbol position is unknown, call `lsp.symbols` on a concrete file first.
- Then call position-based actions (`definition`/`references`/`hover`) with exact `file + line + column`.
- Call `lsp.status` once if needed for diagnostics; do not poll repeatedly.
- If `lsp.status` reports no active servers, run a concrete file-based LSP action before deciding LSP is unavailable.
- If LSP results are empty, retry once with corrected file/position or nearby context.
- If LSP still fails or language support is missing, continue with non-LSP tools and state the fallback explicitly.

Quick anti-patterns to avoid:
- Empty/placeholder LSP actions.
- Repeating `lsp.status` with no follow-up action.
- Treating directory-level symbol scans as file-level LSP results.
