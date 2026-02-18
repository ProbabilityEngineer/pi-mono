import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import defaults from "../src/lsp/defaults.json";

const REQUIRED_LANGUAGE_IDS = [
	"astro",
	"csharp",
	"css",
	"dart",
	"dockerfile",
	"elixir",
	"erlang",
	"gleam",
	"go",
	"graphql",
	"haskell",
	"helm",
	"html",
	"java",
	"javascript",
	"javascriptreact",
	"json",
	"jsonc",
	"kotlin",
	"less",
	"lua",
	"markdown",
	"nix",
	"ocaml",
	"odin",
	"php",
	"prisma",
	"python",
	"ruby",
	"rust",
	"sass",
	"scala",
	"scss",
	"shell",
	"svelte",
	"swift",
	"terraform",
	"tex",
	"toml",
	"typescript",
	"typescriptreact",
	"vim",
	"vue",
	"yaml",
] as const;

describe("lsp language parity matrix coverage", () => {
	it("covers all required language IDs in defaults", () => {
		const allDefaultLanguages = new Set<string>();
		for (const server of Object.values(defaults)) {
			for (const languageId of server.languages ?? []) {
				allDefaultLanguages.add(languageId);
			}
		}

		for (const languageId of REQUIRED_LANGUAGE_IDS) {
			expect(allDefaultLanguages.has(languageId)).toBe(true);
		}
	});

	it("documents all required language IDs with valid parity status", () => {
		const matrixPath = join(process.cwd(), "docs", "lsp-parity-matrix.md");
		const matrix = readFileSync(matrixPath, "utf8");
		for (const languageId of REQUIRED_LANGUAGE_IDS) {
			const rowPattern = new RegExp(
				`\\|\\s*\`${languageId}\`\\s*\\|\\s*\`(match|diff|intended divergence)\`\\s*\\|`,
			);
			expect(rowPattern.test(matrix)).toBe(true);
		}
	});
});
