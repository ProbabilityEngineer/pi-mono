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
- If target source files are unknown, discover candidate files with `ast-grep` when available. Use `grep`/`find` only when `ast-grep` is unavailable or fails.
- After discovery for semantic tasks, run `lsp.symbols` on a concrete file path (not a directory), then use position-based LSP actions as needed.
- Only call `lsp` with a valid `action` (`hover|definition|references|symbols|diagnostics|rename|format|status|reload`); never send empty or placeholder actions.
- Use `lsp.status` at most once per turn. If it reports no active servers, stop polling and either run a concrete file-based LSP action or fall back to `read`/`grep`/`find`.
- If LSP returns no result, retry once with corrected position/context, then fall back to non-LSP tools.
- Use `lsp.rename`/`lsp.format` only when edit/write tools are available; in read-only runs, skip mutating LSP actions.
- If `lsp=disabled` or unsupported for the language, use `read`/`grep`/`find` workflows directly.
