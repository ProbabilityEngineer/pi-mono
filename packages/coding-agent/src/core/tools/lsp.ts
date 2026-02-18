import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import {
	type DocumentSymbol,
	type Location,
	lspDefinition,
	lspDocumentSymbols,
	lspHover,
	lspReferences,
	lspWorkspaceSymbols,
	type SymbolInformation,
} from "../../lsp/index.js";
import { resolveToCwd } from "./path-utils.js";

const lspSchema = Type.Object({
	action: Type.Union(
		[Type.Literal("hover"), Type.Literal("definition"), Type.Literal("references"), Type.Literal("symbols")],
		{
			description: "LSP operation to run",
		},
	),
	file: Type.Optional(Type.String({ description: "File path for file-based operations" })),
	line: Type.Optional(Type.Number({ description: "1-indexed line number (default: 1)" })),
	column: Type.Optional(Type.Number({ description: "1-indexed column number (default: 1)" })),
	query: Type.Optional(Type.String({ description: "Workspace symbol query (required when symbols has no file)" })),
	include_declaration: Type.Optional(
		Type.Boolean({ description: "Include declaration in references (default: true)" }),
	),
});

export type LspToolInput = Static<typeof lspSchema>;

export interface LspToolDetails {
	action: LspToolInput["action"];
	serverName?: string;
	success: boolean;
}

function formatLocation(location: Location, cwd: string): string {
	let filePath = location.uri;
	try {
		if (location.uri.startsWith("file://")) {
			const absolute = fileURLToPath(location.uri);
			filePath = relative(cwd, absolute) || absolute;
		}
	} catch {
		// Keep raw URI when it can't be converted.
	}
	const line = location.range.start.line + 1;
	const column = location.range.start.character + 1;
	return `${filePath}:${line}:${column}`;
}

function collectDocumentSymbols(symbol: DocumentSymbol, depth: number, output: string[]): void {
	const indent = "  ".repeat(depth);
	const line = symbol.selectionRange.start.line + 1;
	output.push(`${indent}${symbol.name} (line ${line})`);
	for (const child of symbol.children ?? []) {
		collectDocumentSymbols(child, depth + 1, output);
	}
}

function formatDocumentSymbolOutput(symbols: Array<DocumentSymbol | SymbolInformation>, cwd: string): string[] {
	if (symbols.length === 0) {
		return [];
	}

	const first = symbols[0];
	if ("selectionRange" in first) {
		const output: string[] = [];
		for (const symbol of symbols as DocumentSymbol[]) {
			collectDocumentSymbols(symbol, 0, output);
		}
		return output;
	}

	return (symbols as SymbolInformation[]).map((symbol) => {
		const line = symbol.location.range.start.line + 1;
		const pathText = formatLocation(symbol.location, cwd);
		return `${symbol.name} (line ${line}) - ${pathText}`;
	});
}

export function createLspTool(cwd: string): AgentTool<typeof lspSchema> {
	return {
		name: "lsp",
		label: "lsp",
		description:
			"Run read-only language intelligence operations (hover, definition, references, symbols) using configured LSP servers.",
		parameters: lspSchema,
		execute: async (
			_toolCallId: string,
			{ action, file, line, column, query, include_declaration }: LspToolInput,
			signal?: AbortSignal,
		) => {
			if (action !== "symbols" && !file) {
				return {
					content: [{ type: "text", text: "Error: file is required for this action." }],
					details: { action, success: false } satisfies LspToolDetails,
				};
			}

			try {
				if (action === "hover") {
					const result = await lspHover({
						cwd,
						filePath: resolveToCwd(file as string, cwd),
						line: line ?? 1,
						column: column ?? 1,
						signal,
					});
					return {
						content: [{ type: "text", text: result.contents || "No hover information." }],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}

				if (action === "definition") {
					const result = await lspDefinition({
						cwd,
						filePath: resolveToCwd(file as string, cwd),
						line: line ?? 1,
						column: column ?? 1,
						signal,
					});
					if (result.locations.length === 0) {
						return {
							content: [{ type: "text", text: "No definitions found." }],
							details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
						};
					}
					return {
						content: [
							{
								type: "text",
								text: `Found ${result.locations.length} definition(s):\n${result.locations
									.map((location) => `- ${formatLocation(location, cwd)}`)
									.join("\n")}`,
							},
						],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}

				if (action === "references") {
					const result = await lspReferences({
						cwd,
						filePath: resolveToCwd(file as string, cwd),
						line: line ?? 1,
						column: column ?? 1,
						includeDeclaration: include_declaration,
						signal,
					});
					if (result.references.length === 0) {
						return {
							content: [{ type: "text", text: "No references found." }],
							details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
						};
					}
					return {
						content: [
							{
								type: "text",
								text: `Found ${result.references.length} reference(s):\n${result.references
									.map((location) => `- ${formatLocation(location, cwd)}`)
									.join("\n")}`,
							},
						],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}

				if (file) {
					const result = await lspDocumentSymbols({
						cwd,
						filePath: resolveToCwd(file, cwd),
						signal,
					});
					const formatted = formatDocumentSymbolOutput(result.symbols, cwd);
					if (formatted.length === 0) {
						return {
							content: [{ type: "text", text: "No symbols found." }],
							details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
						};
					}
					return {
						content: [{ type: "text", text: formatted.join("\n") }],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}

				if (!query) {
					return {
						content: [{ type: "text", text: "Error: query is required for workspace symbols." }],
						details: { action, success: false } satisfies LspToolDetails,
					};
				}

				const result = await lspWorkspaceSymbols({ cwd, query, signal });
				if (result.symbols.length === 0) {
					return {
						content: [{ type: "text", text: `No workspace symbols found for "${query}".` }],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}
				return {
					content: [
						{
							type: "text",
							text: result.symbols
								.map((symbol) => `- ${symbol.name} (${formatLocation(symbol.location, cwd)})`)
								.join("\n"),
						},
					],
					details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `LSP error: ${message}` }],
					details: { action, success: false } satisfies LspToolDetails,
				};
			}
		},
	};
}

export const lspTool = createLspTool(process.cwd());
