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
- If `lsp=disabled` or unsupported for the language, use `read`/`grep`/`find` workflows directly.
- If `ast-grep=available`, use it for bulk structural rewrites across many files.
- If `ast-grep=unavailable`, do not plan around `ast-grep`; use standard tools instead.
- For ambiguous symbols, use document/workspace symbols before broad text matching.
- Verify final file text with `read` before summarizing edits.
