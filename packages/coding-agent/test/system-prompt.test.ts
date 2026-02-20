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
				"Do not start semantic workflows with `lsp.status`. First locate a concrete source file path, then run a file-scoped LSP action.",
			);
			expect(prompt).toContain(
				"Use `lsp.status` sparingly (at most once per turn) for diagnostics only; it is optional and should not block direct file-based LSP calls.",
			);
			expect(prompt).toContain(
				"if `lsp=enabled` you must run at least one concrete LSP call before finalizing the answer.",
			);
			expect(prompt).toContain(
				"For reference-finding requests, prefer one concrete `lsp.references`/`lsp.symbols` attempt first, then move on quickly if results are empty.",
			);
			expect(prompt).toContain(
				"Use `ast-grep` primarily for structural pattern matching and bulk rewrites, not as the sole completeness mechanism for symbol-reference reporting.",
			);
			expect(prompt).toContain(
				"For completeness after LSP/ast-grep, run a lexical backstop query (`rg` preferred, then `grep`) over likely source files and merge/dedupe results.",
			);
			expect(prompt).toContain("If `ast-grep=available`, use it for bulk structural rewrites across many files.");
			expect(prompt).toContain(
				"After discovery for semantic tasks, run `lsp.symbols` on a concrete file path (not a directory), then use position-based LSP actions as needed.",
			);
			expect(prompt).toContain(
				"If LSP returns no result or an indexing error, do not keep retrying. Continue with non-LSP tools and ensure lexical backstop coverage before finalizing.",
			);
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
