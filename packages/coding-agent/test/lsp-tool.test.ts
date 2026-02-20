import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLspTool } from "../src/core/tools/lsp.js";

const mockLspHover = vi.fn();
const mockLspDefinition = vi.fn();
const mockLspReferences = vi.fn();
const mockLspDocumentSymbols = vi.fn();
const mockLspWorkspaceSymbols = vi.fn();
const mockLspDiagnostics = vi.fn();
const mockLspRename = vi.fn();
const mockLspFormatDocument = vi.fn();
const mockFormatDiagnostics = vi.fn();
const mockFormatWorkspaceEdit = vi.fn();
const mockGetActiveClients = vi.fn();
const mockShutdownAll = vi.fn();

vi.mock("../src/lsp/index.js", () => ({
	lspHover: (...args: unknown[]) => mockLspHover(...args),
	lspDefinition: (...args: unknown[]) => mockLspDefinition(...args),
	lspReferences: (...args: unknown[]) => mockLspReferences(...args),
	lspDocumentSymbols: (...args: unknown[]) => mockLspDocumentSymbols(...args),
	lspWorkspaceSymbols: (...args: unknown[]) => mockLspWorkspaceSymbols(...args),
	lspDiagnostics: (...args: unknown[]) => mockLspDiagnostics(...args),
	lspRename: (...args: unknown[]) => mockLspRename(...args),
	lspFormatDocument: (...args: unknown[]) => mockLspFormatDocument(...args),
	formatDiagnostics: (...args: unknown[]) => mockFormatDiagnostics(...args),
	formatWorkspaceEdit: (...args: unknown[]) => mockFormatWorkspaceEdit(...args),
	getActiveClients: (...args: unknown[]) => mockGetActiveClients(...args),
	shutdownAll: (...args: unknown[]) => mockShutdownAll(...args),
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

	it("defaults empty action to status with corrective guidance", async () => {
		mockGetActiveClients.mockReturnValueOnce([]);
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-empty", { action: "" });
		expect(getTextContent(result)).toContain('defaulted to "status"');
		expect(getTextContent(result)).toContain("Status is optional");
		expect(getTextContent(result)).toContain("Do not keep polling status");
	});

	it("returns actionable error for invalid action", async () => {
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-invalid", { action: "wat" });
		expect(getTextContent(result)).toContain('invalid action "wat"');
		expect(getTextContent(result)).toContain("Valid actions");
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

	it("filters document symbols by query when file is provided", async () => {
		mockLspDocumentSymbols.mockResolvedValueOnce({
			server: "tsserver",
			symbols: [
				{
					name: "AgentSession",
					kind: 5,
					range: { start: { line: 9, character: 0 }, end: { line: 30, character: 1 } },
					selectionRange: { start: { line: 9, character: 6 }, end: { line: 9, character: 18 } },
					children: [
						{
							name: "getEditMode",
							kind: 6,
							range: { start: { line: 18, character: 2 }, end: { line: 20, character: 3 } },
							selectionRange: { start: { line: 18, character: 2 }, end: { line: 18, character: 13 } },
						},
						{
							name: "setModel",
							kind: 6,
							range: { start: { line: 22, character: 2 }, end: { line: 24, character: 3 } },
							selectionRange: { start: { line: 22, character: 2 }, end: { line: 22, character: 10 } },
						},
					],
				},
			],
		});

		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-6a", {
			action: "symbols",
			file: "src/agent-session.ts",
			query: "getEditMode",
		});

		const text = getTextContent(result);
		expect(text).toContain("getEditMode (line 19)");
		expect(text).not.toContain("setModel");
	});

	it("ranks workspace symbols with exact match first", async () => {
		mockLspWorkspaceSymbols.mockResolvedValueOnce({
			server: "tsserver",
			symbols: [
				{
					name: "getEditModeLegacy",
					kind: 6,
					location: {
						uri: "file:///workspace/src/legacy.ts",
						range: {
							start: { line: 11, character: 2 },
							end: { line: 11, character: 15 },
						},
					},
				},
				{
					name: "getEditMode",
					kind: 6,
					location: {
						uri: "file:///workspace/src/settings-manager.ts",
						range: {
							start: { line: 902, character: 1 },
							end: { line: 902, character: 12 },
						},
					},
				},
			],
		});

		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-6b", { action: "symbols", query: "getEditMode" });
		const text = getTextContent(result);
		const firstLine = text.split("\n")[0] ?? "";
		expect(firstLine).toContain("- getEditMode (src/settings-manager.ts:903:2)");
	});

	it("renders diagnostics using formatter", async () => {
		mockLspDiagnostics.mockResolvedValueOnce({
			server: "tsserver",
			diagnostics: [{ message: "warning message" }],
		});
		mockFormatDiagnostics.mockReturnValueOnce(["src/index.ts:1:1 [warning] warning message"]);

		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-6", { action: "diagnostics", file: "src/index.ts" });
		expect(getTextContent(result)).toContain("warning message");
	});

	it("supports rename preview and apply", async () => {
		mockLspRename.mockResolvedValueOnce({
			server: "tsserver",
			applied: false,
			edit: { changes: {} },
			changes: [],
		});
		mockFormatWorkspaceEdit.mockReturnValueOnce(["src/index.ts: 1 edit(s)"]);

		const tool = createLspTool("/workspace");
		const preview = await tool.execute("call-7", {
			action: "rename",
			file: "src/index.ts",
			line: 1,
			column: 1,
			new_name: "nextValue",
			apply: false,
		});
		expect(getTextContent(preview)).toContain("Rename preview");

		mockLspRename.mockResolvedValueOnce({
			server: "tsserver",
			applied: true,
			edit: { changes: {} },
			changes: ["Edited /workspace/src/index.ts"],
		});
		const applied = await tool.execute("call-8", {
			action: "rename",
			file: "src/index.ts",
			line: 1,
			column: 1,
			new_name: "nextValue",
		});
		expect(getTextContent(applied)).toContain("Applied rename");
	});

	it("supports format operation", async () => {
		mockLspFormatDocument.mockResolvedValueOnce({
			server: "tsserver",
			changed: true,
			applied: true,
			editCount: 2,
		});

		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-9", {
			action: "format",
			file: "src/index.ts",
		});
		expect(getTextContent(result)).toContain("Applied formatting");
	});

	it("reports active clients for status action", async () => {
		mockGetActiveClients.mockReturnValueOnce([
			{ name: "typescript-language-server", status: "ready", fileTypes: ["typescript"] },
		]);

		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-status", { action: "status" });
		expect(getTextContent(result)).toContain("Active LSP servers");
		expect(getTextContent(result)).toContain("typescript-language-server");
		expect(mockGetActiveClients).toHaveBeenCalledTimes(1);
	});

	it("reports no active clients with non-loop fallback guidance", async () => {
		mockGetActiveClients.mockReturnValueOnce([]);
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-status-empty", { action: "status" });
		expect(getTextContent(result)).toContain("No active LSP servers");
		expect(getTextContent(result)).toContain("Status is optional");
		expect(getTextContent(result)).toContain("Do not keep polling status");
	});

	it("reloads active lsp clients for reload action", async () => {
		const tool = createLspTool("/workspace");
		const result = await tool.execute("call-reload", { action: "reload" });
		expect(getTextContent(result)).toContain("Reloaded LSP servers");
		expect(mockShutdownAll).toHaveBeenCalledTimes(1);
	});
});
