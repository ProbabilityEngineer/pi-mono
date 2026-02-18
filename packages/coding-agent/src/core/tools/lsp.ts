import { relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import {
	type DocumentSymbol,
	formatDiagnostics,
	formatWorkspaceEdit,
	type Location,
	lspDefinition,
	lspDiagnostics,
	lspDocumentSymbols,
	lspFormatDocument,
	lspHover,
	lspReferences,
	lspRename,
	lspWorkspaceSymbols,
	type SymbolInformation,
} from "../../lsp/index.js";
import { resolveToCwd } from "./path-utils.js";

const lspSchema = Type.Object({
	action: Type.Union(
		[
			Type.Literal("hover"),
			Type.Literal("definition"),
			Type.Literal("references"),
			Type.Literal("symbols"),
			Type.Literal("diagnostics"),
			Type.Literal("rename"),
			Type.Literal("format"),
		],
		{
			description: "LSP operation to run",
		},
	),
	file: Type.Optional(Type.String({ description: "File path for file-based operations" })),
	line: Type.Optional(Type.Number({ description: "1-indexed line number (default: 1)" })),
	column: Type.Optional(Type.Number({ description: "1-indexed column number (default: 1)" })),
	query: Type.Optional(
		Type.String({
			description: "Symbol query (required for workspace symbols, optional filter for document symbols)",
		}),
	),
	include_declaration: Type.Optional(
		Type.Boolean({ description: "Include declaration in references (default: true)" }),
	),
	new_name: Type.Optional(Type.String({ description: "New symbol name for rename action" })),
	apply: Type.Optional(Type.Boolean({ description: "Apply edits/formatting to disk (default: true)" })),
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

interface FlattenedDocumentSymbol {
	name: string;
	line: number;
	depth: number;
	qualifiedName: string;
}

function flattenDocumentSymbols(
	symbol: DocumentSymbol,
	depth: number,
	parentPath: string[],
	output: FlattenedDocumentSymbol[],
): void {
	const line = symbol.selectionRange.start.line + 1;
	const qualifiedParts = [...parentPath, symbol.name];
	output.push({
		name: symbol.name,
		line,
		depth,
		qualifiedName: qualifiedParts.join("."),
	});
	for (const child of symbol.children ?? []) {
		flattenDocumentSymbols(child, depth + 1, qualifiedParts, output);
	}
}

function matchScore(value: string, query: string): number | null {
	const candidate = value.toLowerCase();
	if (candidate === query) {
		return 0;
	}
	if (candidate.startsWith(query)) {
		return 1;
	}
	const boundaryTokens = [".", "/", ":", "_", "-", " "];
	for (const token of boundaryTokens) {
		if (candidate.includes(`${token}${query}`)) {
			return 2;
		}
	}
	if (candidate.includes(query)) {
		return 3;
	}
	return null;
}

function rankAndFilterByQuery<T>(items: T[], query: string | undefined, valuesForItem: (item: T) => string[]): T[] {
	const normalizedQuery = query?.trim().toLowerCase() ?? "";
	if (normalizedQuery.length === 0) {
		return items;
	}

	return items
		.map((item, index) => {
			let bestScore: number | null = null;
			let bestLength = Number.POSITIVE_INFINITY;
			for (const value of valuesForItem(item)) {
				const score = matchScore(value, normalizedQuery);
				if (score === null) {
					continue;
				}
				if (bestScore === null || score < bestScore) {
					bestScore = score;
					bestLength = value.length;
					continue;
				}
				if (score === bestScore && value.length < bestLength) {
					bestLength = value.length;
				}
			}
			return { item, index, score: bestScore, length: bestLength };
		})
		.filter((entry): entry is { item: T; index: number; score: number; length: number } => entry.score !== null)
		.sort((left, right) => {
			if (left.score !== right.score) {
				return left.score - right.score;
			}
			if (left.length !== right.length) {
				return left.length - right.length;
			}
			return left.index - right.index;
		})
		.map((entry) => entry.item);
}

function formatDocumentSymbolOutput(
	symbols: Array<DocumentSymbol | SymbolInformation>,
	cwd: string,
	query?: string,
): string[] {
	if (symbols.length === 0) {
		return [];
	}

	const first = symbols[0];
	if ("selectionRange" in first) {
		const flattened: FlattenedDocumentSymbol[] = [];
		for (const symbol of symbols as DocumentSymbol[]) {
			flattenDocumentSymbols(symbol, 0, [], flattened);
		}
		const filtered = rankAndFilterByQuery(flattened, query, (symbol) => [symbol.name, symbol.qualifiedName]);
		if (query && filtered.length === 0) {
			return [];
		}
		const selected = query ? filtered : flattened;
		return selected.map((symbol) => `${"  ".repeat(symbol.depth)}${symbol.name} (line ${symbol.line})`);
	}

	const filtered = rankAndFilterByQuery(symbols as SymbolInformation[], query, (symbol) => [
		symbol.name,
		symbol.containerName ?? "",
	]);
	const selected = query ? filtered : (symbols as SymbolInformation[]);
	return selected.map((symbol) => {
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
			"Run LSP operations (hover, definition, references, symbols, diagnostics, rename, format) using configured language servers. definition/references/hover are position-based (file+line+column); use symbols first when you only have a name.",
		parameters: lspSchema,
		execute: async (
			_toolCallId: string,
			{ action, file, line, column, query, include_declaration, new_name, apply }: LspToolInput,
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

				if (action === "diagnostics") {
					const resolvedFile = resolveToCwd(file as string, cwd);
					const result = await lspDiagnostics({ cwd, filePath: resolvedFile, signal });
					if (result.diagnostics.length === 0) {
						return {
							content: [{ type: "text", text: "No diagnostics." }],
							details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
						};
					}
					const rendered = formatDiagnostics(result.diagnostics, pathToFileURL(resolvedFile).toString(), cwd);
					return {
						content: [{ type: "text", text: rendered.join("\n") }],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}

				if (action === "rename") {
					if (!new_name) {
						return {
							content: [{ type: "text", text: "Error: new_name is required for rename." }],
							details: { action, success: false } satisfies LspToolDetails,
						};
					}
					const result = await lspRename({
						cwd,
						filePath: resolveToCwd(file as string, cwd),
						line: line ?? 1,
						column: column ?? 1,
						newName: new_name,
						apply,
						signal,
					});
					if (!result.edit) {
						return {
							content: [{ type: "text", text: "No rename edits returned." }],
							details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
						};
					}
					if (!result.applied) {
						const preview = formatWorkspaceEdit(result.edit, cwd);
						return {
							content: [{ type: "text", text: `Rename preview:\n${preview.join("\n")}` }],
							details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
						};
					}
					return {
						content: [{ type: "text", text: `Applied rename:\n${result.changes.join("\n")}` }],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}

				if (action === "format") {
					const result = await lspFormatDocument({
						cwd,
						filePath: resolveToCwd(file as string, cwd),
						apply,
						signal,
					});
					if (!result.changed) {
						return {
							content: [{ type: "text", text: "No formatting changes." }],
							details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
						};
					}
					const text =
						apply === false
							? `Formatting preview available (${result.editCount} edit(s)).`
							: `Applied formatting (${result.editCount} edit(s)).`;
					return {
						content: [{ type: "text", text }],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}

				if (file) {
					const result = await lspDocumentSymbols({
						cwd,
						filePath: resolveToCwd(file, cwd),
						signal,
					});
					const formatted = formatDocumentSymbolOutput(result.symbols, cwd, query);
					if (formatted.length === 0) {
						return {
							content: [
								{ type: "text", text: query ? `No symbols found for "${query}".` : "No symbols found." },
							],
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
				const filteredSymbols = rankAndFilterByQuery(result.symbols, query, (symbol) => [
					symbol.name,
					symbol.containerName ?? "",
				]);
				if (filteredSymbols.length === 0) {
					return {
						content: [{ type: "text", text: `No workspace symbols found for "${query}".` }],
						details: { action, serverName: result.server, success: true } satisfies LspToolDetails,
					};
				}
				return {
					content: [
						{
							type: "text",
							text: filteredSymbols
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
