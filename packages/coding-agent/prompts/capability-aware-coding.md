---
description: Capability-aware coding policy for LSP and ast-grep usage
---
Use capability-aware tool selection for this task.

Capability statuses to determine first:
- `ast-grep`: `available|unavailable`
- `lsp`: `enabled|disabled`
- per-language LSP server: `installed|missing|auto-installable`

Policy:
- Treat requests as intent classes:
  - semantic lookup (`definition|references|symbols|hover|diagnostics|rename|format`)
  - structural rewrite/discovery
  - completeness-required reporting
- For semantic lookup tasks, use discovery-first order: locate concrete source files first (`rg`/`find`, or `ast-grep` for structural discovery), then run one anchored file-scoped LSP call when `lsp=enabled`.
- For semantic lookup/completeness-required tasks, do not call `lsp.status` unless the user explicitly asks for LSP/server diagnostics.
- For semantic lookup where completeness matters, do at most one concrete `lsp.references`/`lsp.symbols` attempt after anchoring, then move on quickly if results are empty.
- Tool budget for lookup tasks: at most one LSP attempt, at most one ast-grep structural probe, and one lexical backstop before finalizing.
- Use `ast-grep` primarily for structural pattern matching and bulk rewrites, not as the sole completeness mechanism for symbol-reference reporting.
- For completeness-required reporting, run a lexical backstop query (`rg` preferred, then `grep`) over likely source files and merge/dedupe results.
- Standardize completeness backstop to one canonical lexical query for the symbol set, then merge/dedupe results.
- Only call `lsp` with a valid `action` (`hover|definition|references|symbols|diagnostics|rename|format|status|reload`); never send empty or placeholder actions.
- If diagnostics are explicitly requested, use `lsp.status` at most once per turn; it must not block direct file-based LSP calls.
- If LSP returns no result or an indexing error, do not keep retrying. Continue with non-LSP tools and ensure lexical backstop coverage before finalizing.
- If the first LSP call has low-confidence context (unanchored position, wrong file, or obvious mismatch), skip further LSP retries and move to the backstop.
- Use `lsp.rename`/`lsp.format` only when edit/write tools are available; in read-only runs, skip mutating LSP actions.
- If `lsp=disabled` or unsupported for the language, use `read`/`grep`/`find` workflows directly.
- Default to concise evidence output:
  - one compact list of `file:line` entries with short snippets
  - one optional total-count line
  - no long narrative analysis unless the user asks for it
