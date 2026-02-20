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
			expect(prompt).toContain(
				"Discovery-first: locate candidate source files before semantic calls (`rg`/`find`, or `ast-grep` for structural discovery).",
			);
			expect(prompt).toContain(
				"For semantic lookup, run at most one anchored LSP call (`symbols|references|definition|hover` as appropriate).",
			);
			expect(prompt).toContain(
				"If the LSP call is empty/error or low-confidence, stop LSP retries and run one canonical lexical backstop query (`rg -n` preferred), then dedupe and finalize.",
			);
			expect(prompt).toContain("If `ast-grep=available`, use it for bulk structural rewrites across many files.");
			expect(prompt).toContain("Output concise evidence only:");
			expect(prompt).toContain("`file:line: matched line`");
			expect(prompt).toContain("optional total-count line");
			expect(prompt).toContain("no long narrative analysis unless asked.");
			expect(prompt).toContain("For stricter step-by-step guardrails, use `/capability-aware-coding-detailed`.");
			expect(prompt).not.toContain("Progress gate:");
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
