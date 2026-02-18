import { describe, expect, it } from "vitest";
import { pickServerForOperation } from "../src/lsp/api.js";
import type { ResolvedLspServer } from "../src/lsp/types.js";

function createServer(name: string, isLinter?: boolean): ResolvedLspServer {
	return {
		name,
		command: name,
		languages: ["typescript"],
		isLinter,
	};
}

describe("lsp api server role selection", () => {
	it("prefers non-linter servers for intelligence operations", () => {
		const servers = [createServer("eslint", true), createServer("typescript-language-server", false)];
		const selected = pickServerForOperation(servers, "intelligence");
		expect(selected?.name).toBe("typescript-language-server");
	});

	it("prefers linter servers for linter operations", () => {
		const servers = [createServer("typescript-language-server", false), createServer("eslint", true)];
		const selected = pickServerForOperation(servers, "linter");
		expect(selected?.name).toBe("eslint");
	});

	it("falls back to first server when preferred role is not present", () => {
		const intelligenceOnly = [createServer("typescript-language-server", false)];
		const linterSelected = pickServerForOperation(intelligenceOnly, "linter");
		expect(linterSelected?.name).toBe("typescript-language-server");

		const linterOnly = [createServer("eslint", true)];
		const intelligenceSelected = pickServerForOperation(linterOnly, "intelligence");
		expect(intelligenceSelected?.name).toBe("eslint");
	});
});
