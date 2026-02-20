---
description: Capability-aware coding policy for LSP and ast-grep usage
---
Use capability-aware tool selection for this task.

Capability statuses to determine first:
- `ast-grep`: `available|unavailable`
- `lsp`: `enabled|disabled`
- per-language LSP server: `installed|missing|auto-installable`

Policy:
- For semantic tasks (`definition|references|symbols|hover|diagnostics|rename|format`), if `lsp=enabled` you must run at least one concrete LSP call before finalizing the answer.
- Do not start semantic workflows with `lsp.status`. First locate a concrete source file path, then run a file-scoped LSP action.
- For reference-finding requests, prefer one concrete `lsp.references`/`lsp.symbols` attempt first, then move on quickly if results are empty.
- Use `ast-grep` primarily for structural pattern matching and bulk rewrites, not as the sole completeness mechanism for symbol-reference reporting.
- For completeness after LSP/ast-grep, run a lexical backstop query (`rg` preferred, then `grep`) over likely source files and merge/dedupe results.
- After discovery for semantic tasks, run `lsp.symbols` on a concrete file path (not a directory), then use position-based LSP actions as needed.
- Only call `lsp` with a valid `action` (`hover|definition|references|symbols|diagnostics|rename|format|status|reload`); never send empty or placeholder actions.
- Use `lsp.status` sparingly (at most once per turn) for diagnostics only; it is optional and should not block direct file-based LSP calls.
- If LSP returns no result or an indexing error, do not keep retrying. Continue with non-LSP tools and ensure lexical backstop coverage before finalizing.
- Use `lsp.rename`/`lsp.format` only when edit/write tools are available; in read-only runs, skip mutating LSP actions.
- If `lsp=disabled` or unsupported for the language, use `read`/`grep`/`find` workflows directly.
