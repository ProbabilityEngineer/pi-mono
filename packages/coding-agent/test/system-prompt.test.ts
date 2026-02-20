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
		});

		test("includes lsp when selected", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "lsp"],
				contextFiles: [],
				skills: [],
			});

			expect(prompt).toContain("- lsp:");
		});

		test("auto-injects capability policy with ast-grep available guidance", () => {
			const prompt = buildSystemPrompt({
				contextFiles: [],
				skills: [],
				astGrepAvailable: true,
			});

			expect(prompt).toContain("Use capability-aware tool selection for this task.");
			expect(prompt).toContain("never send empty or placeholder actions.");
			expect(prompt).toContain("Use `lsp.status` at most once per turn.");
			expect(prompt).toContain("discover candidate files first using `ast-grep` when available");
			expect(prompt).toContain("If `ast-grep=available`, use it for bulk structural rewrites across many files.");
			expect(prompt).toContain(
				"After discovery for semantic tasks, run `lsp.symbols` on a concrete file path (not a directory), then use position-based LSP actions as needed.",
			);
			expect(prompt).toContain(
				"If LSP returns no result, retry once with corrected position/context, then fall back to non-LSP tools.",
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
