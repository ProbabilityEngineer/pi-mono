import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type InstallerKind = "npm" | "pip" | "pipx" | "unsupported";

export interface InstallerDefinition {
	kind: InstallerKind;
	package?: string;
	remediation?: string;
}

export interface LspServerDefinition {
	command: string;
	languages: string[];
	installer?: InstallerDefinition;
	disabled?: boolean;
}

export interface LspConfigFile {
	servers?: Record<string, Partial<LspServerDefinition>>;
}

export interface ResolvedLspServer {
	name: string;
	command: string;
	languages: string[];
	installer?: InstallerDefinition;
}

export type LspPlannerAction = "none" | "enable_only" | "install_then_enable";

export interface LspPlannerResult {
	action: LspPlannerAction;
	languageId: string;
	server?: ResolvedLspServer;
	skippedReason?:
		| "no_language"
		| "no_server"
		| "already_enabled_and_available"
		| "auto_enable_disabled"
		| "auto_install_disabled"
		| "already_enabled";
}

export interface ServerConfig {
	command: string;
	args?: string[];
	fileTypes: string[];
	rootMarkers?: string[];
	initOptions?: Record<string, unknown>;
	settings?: Record<string, unknown>;
	disabled?: boolean;
	resolvedCommand?: string;
}

export interface OpenFileState {
	version: number;
	languageId: string;
}

export interface PendingLspRequest {
	resolve: (result: unknown) => void;
	reject: (error: Error) => void;
	method: string;
}

export interface LspClientTransport {
	proc: ChildProcessWithoutNullStreams;
	write(payload: string): Promise<void>;
	kill(signal?: NodeJS.Signals): void;
}

export interface LspClient {
	name: string;
	cwd: string;
	config: ServerConfig;
	transport: LspClientTransport;
	requestId: number;
	pendingRequests: Map<number, PendingLspRequest>;
	messageBuffer: Buffer;
	isReading: boolean;
	lastActivity: number;
	openFiles: Map<string, OpenFileState>;
	serverCapabilities?: Record<string, unknown>;
}

export interface LspJsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params: unknown;
}

export interface LspJsonRpcResponse {
	jsonrpc: "2.0";
	id?: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export interface LspJsonRpcNotification {
	jsonrpc: "2.0";
	method: string;
	params?: unknown;
}

export interface LspmuxState {
	available: boolean;
	running: boolean;
	binaryPath: string | null;
}

export interface LspmuxWrappedCommand {
	command: string;
	args: string[];
	env?: Record<string, string>;
}

export interface LspServerStatus {
	name: string;
	status: "connecting" | "ready" | "error";
	fileTypes: string[];
	error?: string;
}
