import { describe, expect, test } from "vitest";
import { buildSystemPrompt } from "../src/core/system-prompt.js";

describe("buildSystemPrompt", () => {
	describe("empty tools", () => {
		test("shows (none) for empty tools list", () => {
			const prompt = buildSystemPrompt({
				selectedTools: [],
				contextFiles: [],
				skills: [],
			});

			expect(prompt).toContain("Available tools:\n(none)");
		});

		test("shows file paths guideline even with no tools", () => {
			const prompt = buildSystemPrompt({
				selectedTools: [],
				contextFiles: [],
				skills: [],
			});

			expect(prompt).toContain("Show file paths clearly");
		});
	});

	describe("default tools", () => {
		test("includes all default tools", () => {
			const prompt = buildSystemPrompt({
				contextFiles: [],
				skills: [],
			});

			expect(prompt).toContain("- read:");
			expect(prompt).toContain("- bash:");
			expect(prompt).toContain("- edit:");
			expect(prompt).toContain("- write:");
			expect(prompt).toContain("- lsp:");
			expect(prompt).toContain("- ast-grep:");
		});

		test("includes lsp when selected", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "lsp"],
				contextFiles: [],
				skills: [],
			});

			expect(prompt).toContain("- lsp:");
		});

		test("includes explicit lsp-first semantic guidance when lsp is selected", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "lsp"],
				contextFiles: [],
				skills: [],
			});

			expect(prompt).toContain(
				"For requests about references/definitions/hover/symbols/rename/diagnostics, start with a concrete LSP call before text search.",
			);
		});

		test("auto-injects capability policy with ast-grep available guidance", () => {
			const prompt = buildSystemPrompt({
				contextFiles: [],
				skills: [],
				astGrepAvailable: true,
			});

			expect(prompt).toContain("Use capability-aware tool selection for this task.");
			expect(prompt).toContain("Use ast-grep for syntax-aware structural queries and bulk code-shape matching.");
			expect(prompt).toContain("never send empty or placeholder actions.");
			expect(prompt).toContain(
				"For semantic lookup tasks, use discovery-first order: locate concrete source files first (`rg`/`find`, or `ast-grep` for structural discovery), then run one anchored file-scoped LSP call when `lsp=enabled`.",
			);
			expect(prompt).toContain(
				"For semantic lookup/completeness-required tasks, do not call `lsp.status` unless the user explicitly asks for LSP/server diagnostics.",
			);
			expect(prompt).toContain(
				"For semantic lookup where completeness matters, do at most one concrete `lsp.references`/`lsp.symbols` attempt after anchoring, then move on quickly if results are empty.",
			);
			expect(prompt).toContain(
				"Tool budget for lookup tasks: at most one LSP attempt, at most one ast-grep structural probe, and one lexical backstop before finalizing.",
			);
			expect(prompt).toContain(
				"Use `ast-grep` primarily for structural pattern matching and bulk rewrites, not as the sole completeness mechanism for symbol-reference reporting.",
			);
			expect(prompt).toContain(
				"For completeness-required reporting, run a lexical backstop query (`rg` preferred, then `grep`) over likely source files and merge/dedupe results.",
			);
			expect(prompt).toContain("If `ast-grep=available`, use it for bulk structural rewrites across many files.");
			expect(prompt).toContain(
				"Standardize completeness backstop to one canonical lexical query for the symbol set, then merge/dedupe results.",
			);
			expect(prompt).toContain(
				"If LSP returns no result or an indexing error, do not keep retrying. Continue with non-LSP tools and ensure lexical backstop coverage before finalizing.",
			);
			expect(prompt).toContain(
				"If the first LSP call has low-confidence context (unanchored position, wrong file, or obvious mismatch), skip further LSP retries and move to the backstop.",
			);
			expect(prompt).toContain(
				"If diagnostics are explicitly requested, use `lsp.status` at most once per turn; it must not block direct file-based LSP calls.",
			);
			expect(prompt).toContain("Default to concise evidence output:");
			expect(prompt).toContain("one compact list of `file:line` entries with short snippets");
			expect(prompt).toContain("one optional total-count line");
			expect(prompt).toContain("no long narrative analysis unless the user asks for it");
			expect(prompt).not.toContain("transition to LSP as early as possible");
			expect(prompt).not.toContain("Quick anti-patterns to avoid:");
			expect(prompt).not.toContain("If `ast-grep=unavailable`, do not plan around `ast-grep`");
		});

		test("auto-injects capability policy with ast-grep unavailable guidance", () => {
			const prompt = buildSystemPrompt({
				contextFiles: [],
				skills: [],
				astGrepAvailable: false,
			});

			expect(prompt).toContain("Use capability-aware tool selection for this task.");
			expect(prompt).toContain(
				"If `ast-grep=unavailable`, do not plan around `ast-grep`; use standard tools instead.",
			);
			expect(prompt).not.toContain("If `ast-grep=available`, use it for bulk structural rewrites");
		});
	});
});
