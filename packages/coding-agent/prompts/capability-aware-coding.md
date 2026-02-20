---
description: Core capability-aware coding policy
---
Use capability-aware tool selection for this task.

Determine capability statuses first:
- `ast-grep`: `available|unavailable`
- `lsp`: `enabled|disabled`
- per-language LSP server: `installed|missing|auto-installable`

Core policy:
- Discovery-first: locate candidate source files before semantic calls (`rg`/`find`, or `ast-grep` for structural discovery).
- For semantic lookup, run at most one anchored LSP call (`symbols|references|definition|hover` as appropriate).
- If the LSP call is empty/error or low-confidence, stop LSP retries and run one canonical lexical backstop query (`rg -n` preferred), then dedupe and finalize.
- Stop as soon as the evidence set is complete; do not repeat equivalent queries.
- Output concise evidence only:
  - `file:line: matched line`
  - optional total-count line
  - no long narrative analysis unless asked.

Optional:
- For stricter step-by-step guardrails, use `/capability-aware-coding-detailed`.
