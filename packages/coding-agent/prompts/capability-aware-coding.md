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
- Use one generic control loop for lookup/extraction tasks:
  - Progress gate: each tool call must add new information; if two consecutive calls add no new information, switch strategy and finish.
  - Bounded search: cap lookup/extraction attempts (for example, max 3 calls) before summarizing best available evidence.
  - Evidence-first output: end with a compact deduped evidence list.
  - Early stop on success: if a tool call returns an evidence-complete result set for the request, stop querying and finalize.
  - Query dedupe: do not repeat identical or near-identical queries in the same turn once they have already succeeded.
- For semantic lookup tasks, use discovery-first order: locate concrete source files first (`rg`/`find`, or `ast-grep` for structural discovery), then run one anchored file-scoped LSP call when `lsp=enabled`.
- For semantic lookup/completeness-required tasks, do not call `lsp.status` unless the user explicitly asks for LSP/server diagnostics.
- For semantic lookup where completeness matters, do at most one concrete `lsp.references`/`lsp.symbols` attempt after anchoring, then move on quickly if results are empty.
- Tool budget for lookup tasks: at most one LSP attempt, at most one ast-grep structural probe, and one lexical backstop before finalizing.
- Use `ast-grep` primarily for structural pattern matching and bulk rewrites, not as the sole completeness mechanism for symbol-reference reporting.
- For completeness-required reporting, run a lexical backstop query (`rg` preferred, then `grep`) over likely source files and merge/dedupe results.
- Standardize completeness backstop to one canonical lexical query for the symbol set, then merge/dedupe results.
- For extraction/listing requests (e.g., "find/list all declarations/usages"), stop after collecting sufficient evidence lines; avoid exploratory full-file reads unless a matched line lacks needed context.
- If a tool already returns `file:line` plus matched line text, use that output directly instead of re-reading files for the same evidence.
- Pattern-retry discipline: for the same search intent, do at most two pattern attempts per tool, then switch strategy.
- Only call `lsp` with a valid `action` (`hover|definition|references|symbols|diagnostics|rename|format|status|reload`); never send empty or placeholder actions.
- If diagnostics are explicitly requested, use `lsp.status` at most once per turn; it must not block direct file-based LSP calls.
- If LSP returns no result or an indexing error, do not keep retrying. Continue with non-LSP tools and ensure lexical backstop coverage before finalizing.
- If the first LSP call has low-confidence context (unanchored position, wrong file, or obvious mismatch), skip further LSP retries and move to the backstop.
- Target-position sanity: do not run `lsp.definition`/`lsp.references` on an unanchored declaration position. Anchor the symbol token position first (for example via file-scoped symbols), or skip to lexical backstop.
- Use `lsp.rename`/`lsp.format` only when edit/write tools are available; in read-only runs, skip mutating LSP actions.
- If `lsp=disabled` or unsupported for the language, use `read`/`grep`/`find` workflows directly.
- Default to concise evidence output:
  - one compact list of `file:line` entries with short snippets
  - one optional total-count line
  - no long narrative analysis unless the user asks for it
