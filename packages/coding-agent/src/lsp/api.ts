import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ensureFileOpen, getOrCreateClient, sendRequest } from "./client.js";
import { getServersForLanguage, loadLspServers, resolveCommand } from "./config.js";
import { detectLanguageIdFromPath } from "./detection.js";
import type {
	DocumentSymbol,
	Hover,
	Location,
	LocationLink,
	LspDefinitionResult,
	LspDocumentSymbolsResult,
	LspHoverResult,
	LspReferencesResult,
	LspWorkspaceSymbolsResult,
	Position,
	ServerConfig,
	SymbolInformation,
} from "./types.js";

export interface LspOperationInput {
	cwd: string;
	filePath: string;
	line: number;
	column: number;
	signal?: AbortSignal;
}

export interface LspReferencesInput extends LspOperationInput {
	includeDeclaration?: boolean;
}

export interface LspWorkspaceSymbolsInput {
	cwd: string;
	query: string;
	signal?: AbortSignal;
}

function toPosition(line: number, column: number): Position {
	return {
		line: Math.max(0, line - 1),
		character: Math.max(0, column - 1),
	};
}

function fileToUri(filePath: string): string {
	return pathToFileURL(resolve(filePath)).toString();
}

function extractHoverText(contents: Hover["contents"]): string {
	if (typeof contents === "string") {
		return contents;
	}

	if (Array.isArray(contents)) {
		return contents
			.map((entry) => (typeof entry === "string" ? entry : `${entry.language}\n${entry.value}`))
			.join("\n\n");
	}

	return contents.value;
}

function normalizeDefinitionResult(result: Location | Location[] | LocationLink | LocationLink[] | null): Location[] {
	if (!result) {
		return [];
	}

	const values = Array.isArray(result) ? result : [result];
	const locations: Location[] = [];
	for (const value of values) {
		if ("uri" in value) {
			locations.push(value);
			continue;
		}

		locations.push({
			uri: value.targetUri,
			range: value.targetSelectionRange ?? value.targetRange,
		});
	}

	return locations;
}

async function resolveClientForFile(cwd: string, filePath: string) {
	const absolutePath = resolve(cwd, filePath);
	const languageId = detectLanguageIdFromPath(absolutePath);
	if (!languageId) {
		throw new Error(`No language detected for ${filePath}`);
	}

	const server = getServersForLanguage(languageId, cwd)[0];
	if (!server) {
		throw new Error(`No configured LSP server for language ${languageId}`);
	}

	const config: ServerConfig = {
		command: server.command,
		args: server.args,
		resolvedCommand: resolveCommand(server.command, cwd) ?? undefined,
		fileTypes: server.languages,
	};
	const client = await getOrCreateClient(config, cwd);
	await ensureFileOpen(client, absolutePath);
	return { absolutePath, client, serverName: server.name };
}

async function resolveAnyClient(cwd: string) {
	const servers = Object.values(loadLspServers(cwd)).sort((a, b) => a.name.localeCompare(b.name));
	const server = servers[0];
	if (!server) {
		throw new Error("No configured LSP servers");
	}
	const config: ServerConfig = {
		command: server.command,
		args: server.args,
		resolvedCommand: resolveCommand(server.command, cwd) ?? undefined,
		fileTypes: server.languages,
	};
	const client = await getOrCreateClient(config, cwd);
	return { client, serverName: server.name };
}

export async function lspHover(input: LspOperationInput): Promise<LspHoverResult> {
	const { absolutePath, client, serverName } = await resolveClientForFile(input.cwd, input.filePath);
	const result = (await sendRequest(
		client,
		"textDocument/hover",
		{
			textDocument: { uri: fileToUri(absolutePath) },
			position: toPosition(input.line, input.column),
		},
		input.signal,
	)) as Hover | null;

	if (!result || !result.contents) {
		return { server: serverName, contents: "" };
	}

	return {
		server: serverName,
		contents: extractHoverText(result.contents),
		range: result.range,
	};
}

export async function lspDefinition(input: LspOperationInput): Promise<LspDefinitionResult> {
	const { absolutePath, client, serverName } = await resolveClientForFile(input.cwd, input.filePath);
	const result = (await sendRequest(
		client,
		"textDocument/definition",
		{
			textDocument: { uri: fileToUri(absolutePath) },
			position: toPosition(input.line, input.column),
		},
		input.signal,
	)) as Location | Location[] | LocationLink | LocationLink[] | null;

	return {
		server: serverName,
		locations: normalizeDefinitionResult(result),
	};
}

export async function lspReferences(input: LspReferencesInput): Promise<LspReferencesResult> {
	const { absolutePath, client, serverName } = await resolveClientForFile(input.cwd, input.filePath);
	const result = (await sendRequest(
		client,
		"textDocument/references",
		{
			textDocument: { uri: fileToUri(absolutePath) },
			position: toPosition(input.line, input.column),
			context: { includeDeclaration: input.includeDeclaration ?? true },
		},
		input.signal,
	)) as Location[] | null;

	return {
		server: serverName,
		references: result ?? [],
	};
}

export async function lspDocumentSymbols(
	input: Omit<LspOperationInput, "line" | "column">,
): Promise<LspDocumentSymbolsResult> {
	const { absolutePath, client, serverName } = await resolveClientForFile(input.cwd, input.filePath);
	const result = (await sendRequest(
		client,
		"textDocument/documentSymbol",
		{
			textDocument: { uri: fileToUri(absolutePath) },
		},
		input.signal,
	)) as Array<DocumentSymbol | SymbolInformation> | null;

	return {
		server: serverName,
		symbols: result ?? [],
	};
}

export async function lspWorkspaceSymbols(input: LspWorkspaceSymbolsInput): Promise<LspWorkspaceSymbolsResult> {
	const { client, serverName } = await resolveAnyClient(input.cwd);
	const result = (await sendRequest(client, "workspace/symbol", { query: input.query }, input.signal)) as
		| SymbolInformation[]
		| null;

	return {
		server: serverName,
		symbols: result ?? [],
	};
}
