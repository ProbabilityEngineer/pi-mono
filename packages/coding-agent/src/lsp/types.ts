import type { ChildProcessWithoutNullStreams } from "node:child_process";

export type InstallerKind = "npm" | "pip" | "pipx" | "unsupported";

export interface InstallerDefinition {
	kind: InstallerKind;
	package?: string;
	remediation?: string;
}

export interface LspServerDefinition {
	command: string;
	args?: string[];
	languages: string[];
	rootMarkers?: string[];
	initOptions?: Record<string, unknown>;
	settings?: Record<string, unknown>;
	isLinter?: boolean;
	installer?: InstallerDefinition;
	disabled?: boolean;
}

export interface LspConfigFile {
	servers?: Record<string, Partial<LspServerDefinition>>;
}

export interface ResolvedLspServer {
	name: string;
	command: string;
	args?: string[];
	languages: string[];
	rootMarkers?: string[];
	initOptions?: Record<string, unknown>;
	settings?: Record<string, unknown>;
	isLinter?: boolean;
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
	isLinter?: boolean;
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
	diagnostics: Map<string, Diagnostic[]>;
	diagnosticsVersion: number;
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

export interface Position {
	line: number;
	character: number;
}

export interface Range {
	start: Position;
	end: Position;
}

export interface Location {
	uri: string;
	range: Range;
}

export interface LocationLink {
	originSelectionRange?: Range;
	targetUri: string;
	targetRange: Range;
	targetSelectionRange: Range;
}

export interface MarkupContent {
	kind: "plaintext" | "markdown";
	value: string;
}

export type MarkedString = string | { language: string; value: string };

export interface Hover {
	contents: MarkupContent | MarkedString | MarkedString[];
	range?: Range;
}

export interface DocumentSymbol {
	name: string;
	detail?: string;
	kind: number;
	tags?: number[];
	deprecated?: boolean;
	range: Range;
	selectionRange: Range;
	children?: DocumentSymbol[];
}

export interface SymbolInformation {
	name: string;
	kind: number;
	tags?: number[];
	deprecated?: boolean;
	location: Location;
	containerName?: string;
}

export interface Diagnostic {
	range: Range;
	severity?: 1 | 2 | 3 | 4;
	code?: string | number;
	source?: string;
	message: string;
}

export interface TextEdit {
	range: Range;
	newText: string;
}

export interface TextDocumentEdit {
	textDocument: { uri: string; version?: number | null };
	edits: TextEdit[];
}

export interface CreateFileOperation {
	kind: "create";
	uri: string;
}

export interface RenameFileOperation {
	kind: "rename";
	oldUri: string;
	newUri: string;
}

export interface DeleteFileOperation {
	kind: "delete";
	uri: string;
}

export type DocumentChange = TextDocumentEdit | CreateFileOperation | RenameFileOperation | DeleteFileOperation;

export interface WorkspaceEdit {
	changes?: Record<string, TextEdit[]>;
	documentChanges?: DocumentChange[];
}

export interface LspHoverResult {
	server: string;
	contents: string;
	range?: Range;
}

export interface LspDefinitionResult {
	server: string;
	locations: Location[];
}

export interface LspReferencesResult {
	server: string;
	references: Location[];
}

export interface LspDocumentSymbolsResult {
	server: string;
	symbols: Array<DocumentSymbol | SymbolInformation>;
}

export interface LspWorkspaceSymbolsResult {
	server: string;
	symbols: SymbolInformation[];
}

export interface LspDiagnosticsResult {
	server: string;
	diagnostics: Diagnostic[];
}

export interface LspRenameResult {
	server: string;
	edit?: WorkspaceEdit;
	applied: boolean;
	changes: string[];
}

export interface LspFormatResult {
	server: string;
	changed: boolean;
	applied: boolean;
	editCount: number;
}
