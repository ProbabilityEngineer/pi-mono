import { describe, expect, it } from "vitest";
import { createAstGrepTool } from "../src/core/tools/ast-grep.js";

function getText(result: { content: Array<{ type: string; text?: string }> }): string {
	const first = result.content[0];
	if (!first || first.type !== "text") {
		throw new Error("Expected text output");
	}
	return first.text ?? "";
}

describe("ast-grep tool", () => {
	it("returns unavailable guidance when sg and ast-grep are missing", async () => {
		const tool = createAstGrepTool("/workspace", {
			operations: {
				commandAvailable: () => false,
			},
		});

		const result = await tool.execute("call-unavailable", { action: "search", pattern: "class AppState" });
		expect(getText(result)).toContain("ast-grep is unavailable");
	});

	it("runs version action with resolved command", async () => {
		const tool = createAstGrepTool("/workspace", {
			operations: {
				commandAvailable: (command) => command === "sg",
				exec: async () => ({
					exitCode: 0,
					stdout: "sg 0.38.0\n",
					stderr: "",
				}),
			},
		});

		const result = await tool.execute("call-version", { action: "version" });
		expect(getText(result)).toContain("sg 0.38.0");
	});

	it("requires pattern for search action", async () => {
		const tool = createAstGrepTool("/workspace", {
			operations: {
				commandAvailable: (command) => command === "ast-grep",
				exec: async () => ({
					exitCode: 0,
					stdout: "",
					stderr: "",
				}),
			},
		});

		const result = await tool.execute("call-missing-pattern", { action: "search" });
		expect(getText(result)).toContain("pattern is required");
	});

	it("returns search output when matches are present", async () => {
		const tool = createAstGrepTool("/workspace", {
			operations: {
				commandAvailable: (command) => command === "sg",
				exec: async (_command, args) => ({
					exitCode: 0,
					stdout: `ran with ${args.join(" ")}`,
					stderr: "",
				}),
			},
		});

		const result = await tool.execute("call-search", {
			action: "search",
			pattern: "AppState",
			path: "diskfluffer",
			language: "swift",
		});
		expect(getText(result)).toContain("scan --pattern AppState");
		expect(getText(result)).toContain("--lang swift");
	});
});
