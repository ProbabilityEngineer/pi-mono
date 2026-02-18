import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLspTool } from "../src/core/tools/lsp.js";

const mockLspHover = vi.fn();
const mockLspDefinition = vi.fn();
const mockLspReferences = vi.fn();
const mockLspDocumentSymbols = vi.fn();
const mockLspWorkspaceSymbols = vi.fn();

vi.mock("../src/lsp/index.js", () => ({
	lspHover: (...args: unknown[]) => mockLspHover(...args),
	lspDefinition: (...args: unknown[]) => mockLspDefinition(...args),
	lspReferences: (...args: unknown[]) => mockLspReferences(...args),
	lspDocumentSymbols: (...args: unknown[]) => mockLspDocumentSymbols(...args),
	lspWorkspaceSymbols: (...args: unknown[]) => mockLspWorkspaceSymbols(...args),
}));

function getTextContent(result: { content: Array<{ type: string; text?: string }> }): string {
	const first = result.content[0];
	if (first.type !== "text") {
		throw new Error("Expected text content");
	}
	return first.text ?? "";
}

describe("lsp tool", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns validation error for missing file on hover", async () => {
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-1", { action: "hover" });
		expect(result.content[0].type).toBe("text");
		expect(getTextContent(result)).toContain("file is required");
	});

	it("renders hover result", async () => {
		mockLspHover.mockResolvedValueOnce({ server: "tsserver", contents: "hover text" });
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-2", {
			action: "hover",
			file: "src/index.ts",
			line: 1,
			column: 1,
		});

		expect(mockLspHover).toHaveBeenCalledTimes(1);
		expect(result.content[0].type).toBe("text");
		expect(getTextContent(result)).toBe("hover text");
	});

	it("renders definition list", async () => {
		mockLspDefinition.mockResolvedValueOnce({
			server: "tsserver",
			locations: [
				{
					uri: "file:///workspace/src/index.ts",
					range: {
						start: { line: 0, character: 0 },
						end: { line: 0, character: 5 },
					},
				},
			],
		});
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-3", {
			action: "definition",
			file: "src/index.ts",
			line: 1,
			column: 1,
		});

		expect(result.content[0].type).toBe("text");
		expect(getTextContent(result)).toContain("Found 1 definition");
		expect(getTextContent(result)).toContain("src/index.ts:1:1");
	});

	it("requires query for workspace symbols", async () => {
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-4", { action: "symbols" });
		expect(result.content[0].type).toBe("text");
		expect(getTextContent(result)).toContain("query is required");
	});

	it("renders workspace symbol results", async () => {
		mockLspWorkspaceSymbols.mockResolvedValueOnce({
			server: "tsserver",
			symbols: [
				{
					name: "value",
					kind: 13,
					location: {
						uri: "file:///workspace/src/index.ts",
						range: {
							start: { line: 3, character: 1 },
							end: { line: 3, character: 6 },
						},
					},
				},
			],
		});
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-5", { action: "symbols", query: "value" });
		expect(result.content[0].type).toBe("text");
		expect(getTextContent(result)).toContain("value");
		expect(getTextContent(result)).toContain("src/index.ts:4:2");
	});
});
