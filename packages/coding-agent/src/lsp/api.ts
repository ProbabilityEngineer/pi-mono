import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ensureFileOpen, getOrCreateClient, notifySaved, sendRequest, syncContent } from "./client.js";
import { getServersForLanguage, loadLspServers, resolveCommand } from "./config.js";
import { detectLanguageIdFromPath } from "./detection.js";
import { applyTextEditsToString, applyWorkspaceEdit } from "./edits.js";
import type {
	Diagnostic,
	DocumentSymbol,
	Hover,
	Location,
	LocationLink,
	LspDefinitionResult,
	LspDiagnosticsResult,
	LspDocumentSymbolsResult,
	LspFormatResult,
	LspHoverResult,
	LspReferencesResult,
	LspRenameResult,
	LspWorkspaceSymbolsResult,
	Position,
	ResolvedLspServer,
	ServerConfig,
	SymbolInformation,
	TextEdit,
	WorkspaceEdit,
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

export interface LspRenameInput extends LspOperationInput {
	newName: string;
	apply?: boolean;
}

export interface LspFormatInput {
	cwd: string;
	filePath: string;
	apply?: boolean;
	signal?: AbortSignal;
}

export interface LspDiagnosticsInput {
	cwd: string;
	filePath: string;
	signal?: AbortSignal;
}

export type LspServerOperationRole = "intelligence" | "linter";

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

export function pickServerForOperation(
	servers: ResolvedLspServer[],
	role: LspServerOperationRole,
): ResolvedLspServer | undefined {
	if (servers.length === 0) {
		return undefined;
	}
	if (role === "linter") {
		return servers.find((server) => server.isLinter) ?? servers[0];
	}
	return servers.find((server) => !server.isLinter) ?? servers[0];
}

function sortServersForRole(servers: ResolvedLspServer[], role: LspServerOperationRole): ResolvedLspServer[] {
	const preferred = pickServerForOperation(servers, role);
	if (!preferred) {
		return [];
	}
	return [preferred, ...servers.filter((server) => server.name !== preferred.name)];
}

function formatServerFailures(prefix: string, failures: string[]): Error {
	if (failures.length === 0) {
		return new Error(prefix);
	}
	return new Error(`${prefix}. Tried: ${failures.join(" | ")}`);
}

function formatFailureMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function withClientForFile<T>(
	cwd: string,
	filePath: string,
	role: LspServerOperationRole,
	run: (input: {
		absolutePath: string;
		serverName: string;
		client: Awaited<ReturnType<typeof getOrCreateClient>>;
	}) => Promise<T>,
): Promise<T> {
	const absolutePath = resolve(cwd, filePath);
	const languageId = detectLanguageIdFromPath(absolutePath);
	if (!languageId) {
		throw new Error(`No language detected for ${filePath}`);
	}

	const orderedServers = sortServersForRole(getServersForLanguage(languageId, cwd), role);
	if (orderedServers.length === 0) {
		throw new Error(`No configured LSP server for language ${languageId}`);
	}

	const failures: string[] = [];
	for (const server of orderedServers) {
		try {
			const client = await getOrCreateClient(toServerConfig(server, cwd), cwd);
			await ensureFileOpen(client, absolutePath);
			return await run({ absolutePath, serverName: server.name, client });
		} catch (error) {
			failures.push(`${server.name}: ${formatFailureMessage(error)}`);
		}
	}

	throw formatServerFailures(`All configured ${role} LSP servers failed for language ${languageId}`, failures);
}

async function withAnyClient<T>(
	cwd: string,
	role: LspServerOperationRole,
	run: (input: { serverName: string; client: Awaited<ReturnType<typeof getOrCreateClient>> }) => Promise<T>,
): Promise<T> {
	const orderedServers = sortServersForRole(
		Object.values(loadLspServers(cwd)).sort((a, b) => a.name.localeCompare(b.name)),
		role,
	);
	if (orderedServers.length === 0) {
		throw new Error("No configured LSP servers");
	}

	const failures: string[] = [];
	for (const server of orderedServers) {
		try {
			const client = await getOrCreateClient(toServerConfig(server, cwd), cwd);
			return await run({ serverName: server.name, client });
		} catch (error) {
			failures.push(`${server.name}: ${formatFailureMessage(error)}`);
		}
	}

	throw formatServerFailures(`All configured ${role} LSP servers failed`, failures);
}

function toServerConfig(server: ResolvedLspServer, cwd: string): ServerConfig {
	return {
		command: server.command,
		args: server.args,
		resolvedCommand: resolveCommand(server.command, cwd) ?? undefined,
		fileTypes: server.languages,
		rootMarkers: server.rootMarkers,
		initOptions: server.initOptions,
		settings: server.settings,
		isLinter: server.isLinter,
	};
}

export async function lspHover(input: LspOperationInput): Promise<LspHoverResult> {
	return await withClientForFile(
		input.cwd,
		input.filePath,
		"intelligence",
		async ({ absolutePath, client, serverName }) => {
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
		},
	);
}

export async function lspDefinition(input: LspOperationInput): Promise<LspDefinitionResult> {
	return await withClientForFile(
		input.cwd,
		input.filePath,
		"intelligence",
		async ({ absolutePath, client, serverName }) => {
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
		},
	);
}

export async function lspReferences(input: LspReferencesInput): Promise<LspReferencesResult> {
	return await withClientForFile(
		input.cwd,
		input.filePath,
		"intelligence",
		async ({ absolutePath, client, serverName }) => {
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
		},
	);
}

export async function lspDocumentSymbols(
	input: Omit<LspOperationInput, "line" | "column">,
): Promise<LspDocumentSymbolsResult> {
	return await withClientForFile(
		input.cwd,
		input.filePath,
		"intelligence",
		async ({ absolutePath, client, serverName }) => {
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
		},
	);
}

export async function lspWorkspaceSymbols(input: LspWorkspaceSymbolsInput): Promise<LspWorkspaceSymbolsResult> {
	return await withAnyClient(input.cwd, "intelligence", async ({ client, serverName }) => {
		const result = (await sendRequest(client, "workspace/symbol", { query: input.query }, input.signal)) as
			| SymbolInformation[]
			| null;

		return {
			server: serverName,
			symbols: result ?? [],
		};
	});
}

async function waitForDiagnostics(
	client: Awaited<ReturnType<typeof getOrCreateClient>>,
	uri: string,
	minVersion: number,
	timeoutMs: number = 3_000,
): Promise<Diagnostic[]> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const diagnostics = client.diagnostics.get(uri);
		if (diagnostics && client.diagnosticsVersion > minVersion) {
			return diagnostics;
		}
		await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 100));
	}
	return client.diagnostics.get(uri) ?? [];
}

export async function lspDiagnostics(input: LspDiagnosticsInput): Promise<LspDiagnosticsResult> {
	return await withClientForFile(input.cwd, input.filePath, "linter", async ({ absolutePath, client, serverName }) => {
		const uri = fileToUri(absolutePath);
		const before = client.diagnosticsVersion;
		await notifySaved(client, absolutePath);
		const diagnostics = await waitForDiagnostics(client, uri, before);
		return {
			server: serverName,
			diagnostics,
		};
	});
}

export async function lspRename(input: LspRenameInput): Promise<LspRenameResult> {
	return await withClientForFile(
		input.cwd,
		input.filePath,
		"intelligence",
		async ({ absolutePath, client, serverName }) => {
			const result = (await sendRequest(
				client,
				"textDocument/rename",
				{
					textDocument: { uri: fileToUri(absolutePath) },
					position: toPosition(input.line, input.column),
					newName: input.newName,
				},
				input.signal,
			)) as WorkspaceEdit | null;

			if (!result) {
				return {
					server: serverName,
					applied: false,
					changes: [],
				};
			}

			if (input.apply === false) {
				return {
					server: serverName,
					edit: result,
					applied: false,
					changes: [],
				};
			}

			const changes = await applyWorkspaceEdit(result);
			return {
				server: serverName,
				edit: result,
				applied: true,
				changes,
			};
		},
	);
}

export async function lspFormatDocument(input: LspFormatInput): Promise<LspFormatResult> {
	return await withClientForFile(input.cwd, input.filePath, "linter", async ({ absolutePath, client, serverName }) => {
		const edits = (await sendRequest(
			client,
			"textDocument/formatting",
			{
				textDocument: { uri: fileToUri(absolutePath) },
				options: {
					tabSize: 2,
					insertSpaces: true,
					trimTrailingWhitespace: true,
					insertFinalNewline: true,
					trimFinalNewlines: true,
				},
			},
			input.signal,
		)) as TextEdit[] | null;

		const editCount = edits?.length ?? 0;
		if (!edits || edits.length === 0) {
			return {
				server: serverName,
				changed: false,
				applied: false,
				editCount: 0,
			};
		}

		if (input.apply === false) {
			return {
				server: serverName,
				changed: true,
				applied: false,
				editCount,
			};
		}

		const content = await readFile(absolutePath, "utf8");
		const next = applyTextEditsToString(content, edits);
		await writeFile(absolutePath, next, "utf8");
		await syncContent(client, absolutePath, next);
		await notifySaved(client, absolutePath);

		return {
			server: serverName,
			changed: next !== content,
			applied: true,
			editCount,
		};
	});
}
