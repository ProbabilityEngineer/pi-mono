---
description: Capability-aware coding policy for LSP and ast-grep usage
---
Use capability-aware tool selection for this task.

Capability statuses to determine first:
- `ast-grep`: `available|unavailable`
- `lsp`: `enabled|disabled`
- per-language LSP server: `installed|missing|auto-installable`

Policy:
- If `lsp=enabled`, prefer LSP for definitions, references, symbols, hover, diagnostics, and rename safety checks.
- lsp.definition/references/hover are position-based (file + line + column). If you only have a symbol name, use lsp.symbols first to locate position.
- Use lsp.hover to verify types/signatures and lsp.diagnostics before and after code edits when relevant.
- Prefer lsp.rename for symbol renames and lsp.format for formatting when language servers support it.
- If LSP returns no result, read the nearby file region once and retry with corrected position before falling back.
- Use lsp.rename/lsp.format only when edit/write tools are available; in read-only runs, skip mutating LSP actions.
- If `lsp=disabled` or unsupported for the language, use `read`/`grep`/`find` workflows directly.
- For ambiguous symbols, use lsp.document symbols first, then lsp.workspace symbols to disambiguate scope.
- Treat LSP as authoritative for symbol mapping, then verify final code text with `read` before summarizing edits.
- If `ast-grep=available`, use it for bulk structural rewrites across many files.
- If `ast-grep=unavailable`, do not plan around `ast-grep`; use standard tools instead.
