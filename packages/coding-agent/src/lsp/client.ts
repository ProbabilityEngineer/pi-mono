import { type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { detectLanguageIdFromPath } from "./detection.js";
import { getLspmuxCommand, isLspmuxSupported } from "./lspmux.js";
import type {
	Diagnostic,
	LspClient,
	LspClientTransport,
	LspJsonRpcNotification,
	LspJsonRpcRequest,
	LspJsonRpcResponse,
	LspServerStatus,
	OpenFileState,
	ServerConfig,
} from "./types.js";

const clients = new Map<string, LspClient>();
const clientLocks = new Map<string, Promise<LspClient>>();
const fileOperationLocks = new Map<string, Promise<void>>();

let idleTimeoutMs: number | null = null;
let idleCheckInterval: NodeJS.Timeout | null = null;
const IDLE_CHECK_INTERVAL_MS = 60_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export const WARMUP_TIMEOUT_MS = 5_000;

function startIdleChecker(): void {
	if (idleCheckInterval) {
		return;
	}

	idleCheckInterval = setInterval(() => {
		if (!idleTimeoutMs) {
			return;
		}

		const now = Date.now();
		for (const [key, client] of clients.entries()) {
			if (now - client.lastActivity > idleTimeoutMs) {
				shutdownClient(key);
			}
		}
	}, IDLE_CHECK_INTERVAL_MS);
}

function stopIdleChecker(): void {
	if (!idleCheckInterval) {
		return;
	}
	clearInterval(idleCheckInterval);
	idleCheckInterval = null;
}

export function setIdleTimeout(timeoutMs: number | null | undefined): void {
	idleTimeoutMs = timeoutMs ?? null;
	if (idleTimeoutMs && idleTimeoutMs > 0) {
		startIdleChecker();
		return;
	}
	stopIdleChecker();
}

function createClientKey(command: string, args: string[] | undefined, cwd: string): string {
	const argSuffix = args && args.length > 0 ? `:${args.join(" ")}` : "";
	return `${command}${argSuffix}:${cwd}`;
}

function spawnLspServer(
	command: string,
	args: string[],
	cwd: string,
	env?: NodeJS.ProcessEnv,
): ChildProcessWithoutNullStreams {
	const options: SpawnOptionsWithoutStdio = {
		cwd,
		env,
		stdio: "pipe",
	};
	return spawn(command, args, options);
}

function createTransport(proc: ChildProcessWithoutNullStreams): LspClientTransport {
	return {
		proc,
		write(payload: string): Promise<void> {
			return new Promise<void>((resolve, reject) => {
				proc.stdin.write(payload, (error) => {
					if (error) {
						reject(error);
						return;
					}
					resolve();
				});
			});
		},
		kill(signal?: NodeJS.Signals): void {
			proc.kill(signal);
		},
	};
}

function findHeaderEnd(buffer: Uint8Array): number {
	for (let index = 0; index < buffer.length - 3; index += 1) {
		if (buffer[index] === 13 && buffer[index + 1] === 10 && buffer[index + 2] === 13 && buffer[index + 3] === 10) {
			return index;
		}
	}
	return -1;
}

function parseSingleMessage(
	buffer: Buffer,
): { message: LspJsonRpcResponse | LspJsonRpcNotification | LspJsonRpcRequest; remaining: Buffer } | null {
	const headerEnd = findHeaderEnd(buffer);
	if (headerEnd < 0) {
		return null;
	}

	const header = buffer.subarray(0, headerEnd).toString("utf8");
	const match = header.match(/Content-Length:\s*(\d+)/i);
	if (!match) {
		return null;
	}

	const contentLength = Number.parseInt(match[1], 10);
	const messageStart = headerEnd + 4;
	const messageEnd = messageStart + contentLength;
	if (buffer.length < messageEnd) {
		return null;
	}

	const body = buffer.subarray(messageStart, messageEnd).toString("utf8");
	const remaining = buffer.subarray(messageEnd);
	return {
		message: JSON.parse(body) as LspJsonRpcResponse | LspJsonRpcNotification | LspJsonRpcRequest,
		remaining,
	};
}

function createWireMessage(message: LspJsonRpcRequest | LspJsonRpcNotification | LspJsonRpcResponse): string {
	const content = JSON.stringify(message);
	return `Content-Length: ${Buffer.byteLength(content, "utf8")}\r\n\r\n${content}`;
}

async function writeMessage(
	transport: LspClientTransport,
	message: LspJsonRpcRequest | LspJsonRpcNotification | LspJsonRpcResponse,
): Promise<void> {
	await transport.write(createWireMessage(message));
}

function rejectPendingRequests(client: LspClient, reason: Error): void {
	for (const pending of client.pendingRequests.values()) {
		pending.reject(reason);
	}
	client.pendingRequests.clear();
}

function evictClientFromCache(client: LspClient): void {
	const cached = clients.get(client.name);
	if (cached === client) {
		clients.delete(client.name);
	}
}

async function sendResponse(
	client: LspClient,
	id: number,
	result: unknown,
	error?: { code: number; message: string; data?: unknown },
): Promise<void> {
	const response: LspJsonRpcResponse = {
		jsonrpc: "2.0",
		id,
		...(error ? { error } : { result }),
	};
	await writeMessage(client.transport, response);
}

async function handleServerRequest(client: LspClient, request: LspJsonRpcRequest): Promise<void> {
	if (request.method === "workspace/configuration") {
		const params = request.params as { items?: Array<{ section?: string }> };
		const items = params?.items ?? [];
		const result = items.map((item) => client.config.settings?.[item.section ?? ""] ?? {});
		await sendResponse(client, request.id, result);
		return;
	}

	await sendResponse(client, request.id, null, {
		code: -32601,
		message: `Method not found: ${request.method}`,
	});
}

function routeMessage(
	client: LspClient,
	message: LspJsonRpcResponse | LspJsonRpcNotification | LspJsonRpcRequest,
): void {
	if ("id" in message && typeof message.id === "number" && !("method" in message)) {
		const pending = client.pendingRequests.get(message.id);
		if (!pending) {
			return;
		}
		client.pendingRequests.delete(message.id);
		if ("error" in message && message.error) {
			pending.reject(new Error(message.error.message));
			return;
		}
		pending.resolve(message.result);
		return;
	}

	if ("id" in message && "method" in message && typeof message.id === "number") {
		void handleServerRequest(client, message).catch(() => {});
		return;
	}

	if ("method" in message && message.method === "textDocument/publishDiagnostics" && message.params) {
		const params = message.params as { uri: string; diagnostics: Diagnostic[] };
		client.diagnostics.set(params.uri, params.diagnostics);
		client.diagnosticsVersion += 1;
	}
}

function startMessageReader(client: LspClient): void {
	if (client.isReading) {
		return;
	}
	client.isReading = true;

	const onData = (chunk: Buffer): void => {
		try {
			client.messageBuffer = Buffer.concat([client.messageBuffer, chunk]);
			let parsed = parseSingleMessage(client.messageBuffer);
			while (parsed) {
				client.messageBuffer = parsed.remaining;
				routeMessage(client, parsed.message);
				parsed = parseSingleMessage(client.messageBuffer);
			}
		} catch (error) {
			terminationReason = error instanceof Error ? error : new Error(String(error));
			onTerminated();
		}
	};

	let terminated = false;
	let terminationReason: Error | null = null;
	const onProcessError = (error: Error): void => {
		terminationReason = error;
		onTerminated();
	};
	const onTerminated = (): void => {
		if (terminated) {
			return;
		}
		terminated = true;
		client.isReading = false;
		client.transport.proc.stdout.off("data", onData);
		client.transport.proc.stdout.off("end", onTerminated);
		client.transport.proc.stdout.off("error", onTerminated);
		client.transport.proc.off("close", onTerminated);
		client.transport.proc.off("error", onProcessError);
		evictClientFromCache(client);
		rejectPendingRequests(client, terminationReason ?? new Error("LSP connection closed"));
	};

	client.transport.proc.stdout.on("data", onData);
	client.transport.proc.stdout.on("end", onTerminated);
	client.transport.proc.stdout.on("error", onTerminated);
	client.transport.proc.on("close", onTerminated);
	client.transport.proc.on("error", onProcessError);
}

function fileToUri(filePath: string): string {
	return pathToFileURL(filePath).toString();
}

export async function getOrCreateClient(config: ServerConfig, cwd: string, initTimeoutMs?: number): Promise<LspClient> {
	const commandForKey = config.resolvedCommand ?? config.command;
	const key = createClientKey(commandForKey, config.args, cwd);
	const existing = clients.get(key);
	if (existing) {
		existing.lastActivity = Date.now();
		return existing;
	}

	const existingLock = clientLocks.get(key);
	if (existingLock) {
		return existingLock;
	}

	const createPromise = (async () => {
		const baseCommand = config.resolvedCommand ?? config.command;
		const baseArgs = config.args ?? [];
		const wrapped = isLspmuxSupported(baseCommand)
			? await getLspmuxCommand(baseCommand, baseArgs)
			: { command: baseCommand, args: baseArgs };

		const env = wrapped.env ? { ...process.env, ...wrapped.env } : process.env;
		const proc = spawnLspServer(wrapped.command, wrapped.args, cwd, env);
		const transport = createTransport(proc);
		const client: LspClient = {
			name: key,
			cwd,
			config,
			transport,
			requestId: 0,
			pendingRequests: new Map(),
			messageBuffer: Buffer.alloc(0),
			isReading: false,
			lastActivity: Date.now(),
			openFiles: new Map<string, OpenFileState>(),
			diagnostics: new Map(),
			diagnosticsVersion: 0,
		};

		clients.set(key, client);
		startMessageReader(client);

		try {
			const initResult = (await sendRequest(
				client,
				"initialize",
				{
					processId: process.pid,
					rootUri: fileToUri(cwd),
					rootPath: cwd,
					initializationOptions: config.initOptions ?? {},
					capabilities: {
						workspace: {
							configuration: true,
							applyEdit: true,
						},
					},
				},
				undefined,
				initTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
			)) as { capabilities?: Record<string, unknown> };

			client.serverCapabilities = initResult?.capabilities;
			await sendNotification(client, "initialized", {});
			return client;
		} catch (error) {
			clients.delete(key);
			rejectPendingRequests(client, error instanceof Error ? error : new Error(String(error)));
			transport.kill();
			throw error;
		} finally {
			clientLocks.delete(key);
		}
	})();

	clientLocks.set(key, createPromise);
	return createPromise;
}

export async function sendRequest(
	client: LspClient,
	method: string,
	params: unknown,
	signal?: AbortSignal,
	timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<unknown> {
	const requestId = ++client.requestId;
	const request: LspJsonRpcRequest = {
		jsonrpc: "2.0",
		id: requestId,
		method,
		params,
	};

	client.lastActivity = Date.now();

	return await new Promise<unknown>((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason instanceof Error ? signal.reason : new Error("Request aborted"));
			return;
		}

		const clear = (): void => {
			if (signal) {
				signal.removeEventListener("abort", onAbort);
			}
			clearTimeout(timeout);
		};

		const onAbort = (): void => {
			client.pendingRequests.delete(requestId);
			clear();
			void sendNotification(client, "$/cancelRequest", { id: requestId }).catch(() => {});
			reject(signal?.reason instanceof Error ? signal.reason : new Error("Request aborted"));
		};

		const timeout = setTimeout(() => {
			client.pendingRequests.delete(requestId);
			clear();
			reject(new Error(`LSP request ${method} timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		client.pendingRequests.set(requestId, {
			method,
			resolve: (result) => {
				clear();
				resolve(result);
			},
			reject: (error) => {
				clear();
				reject(error);
			},
		});

		if (signal) {
			signal.addEventListener("abort", onAbort, { once: true });
		}

		void writeMessage(client.transport, request).catch((error) => {
			client.pendingRequests.delete(requestId);
			clear();
			reject(error instanceof Error ? error : new Error(String(error)));
		});
	});
}

export async function sendNotification(client: LspClient, method: string, params: unknown): Promise<void> {
	const notification: LspJsonRpcNotification = {
		jsonrpc: "2.0",
		method,
		params,
	};
	client.lastActivity = Date.now();
	await writeMessage(client.transport, notification);
}

export async function ensureFileOpen(client: LspClient, filePath: string, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		throw signal.reason instanceof Error ? signal.reason : new Error("Request aborted");
	}

	const uri = fileToUri(filePath);
	if (client.openFiles.has(uri)) {
		return;
	}

	const lockKey = `${client.name}:${uri}`;
	const existingLock = fileOperationLocks.get(lockKey);
	if (existingLock) {
		await existingLock;
		return;
	}

	const openPromise = (async () => {
		const languageId = detectLanguageIdFromPath(filePath) ?? "plaintext";
		let content = "";
		try {
			content = await readFile(filePath, "utf8");
		} catch (error) {
			const nodeError = error as NodeJS.ErrnoException;
			if (nodeError.code !== "ENOENT") {
				throw error;
			}
		}
		await sendNotification(client, "textDocument/didOpen", {
			textDocument: {
				uri,
				languageId,
				version: 1,
				text: content,
			},
		});
		client.openFiles.set(uri, { languageId, version: 1 });
	})();

	fileOperationLocks.set(lockKey, openPromise);
	try {
		await openPromise;
	} finally {
		fileOperationLocks.delete(lockKey);
	}
}

export async function syncContent(client: LspClient, filePath: string, content: string): Promise<void> {
	const uri = fileToUri(filePath);
	const current = client.openFiles.get(uri);
	if (!current) {
		await sendNotification(client, "textDocument/didOpen", {
			textDocument: {
				uri,
				languageId: detectLanguageIdFromPath(filePath) ?? "plaintext",
				version: 1,
				text: content,
			},
		});
		client.openFiles.set(uri, { languageId: detectLanguageIdFromPath(filePath) ?? "plaintext", version: 1 });
		return;
	}

	current.version += 1;
	await sendNotification(client, "textDocument/didChange", {
		textDocument: { uri, version: current.version },
		contentChanges: [{ text: content }],
	});
}

export async function notifySaved(client: LspClient, filePath: string): Promise<void> {
	const uri = fileToUri(filePath);
	if (!client.openFiles.has(uri)) {
		return;
	}
	await sendNotification(client, "textDocument/didSave", {
		textDocument: { uri },
	});
}

export function shutdownClient(key: string): void {
	const client = clients.get(key);
	if (!client) {
		return;
	}
	clients.delete(key);
	rejectPendingRequests(client, new Error("LSP client shutdown"));
	void sendRequest(client, "shutdown", null).catch(() => {});
	client.transport.kill();
}

export function shutdownAll(): void {
	const keys = Array.from(clients.keys());
	for (const key of keys) {
		shutdownClient(key);
	}
}

export function getActiveClients(): LspServerStatus[] {
	return Array.from(clients.values()).map((client) => ({
		name: client.config.command,
		status: "ready",
		fileTypes: client.config.fileTypes,
	}));
}
