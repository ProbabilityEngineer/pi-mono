export {
	ensureFileOpen,
	getActiveClients,
	getOrCreateClient,
	notifySaved,
	sendNotification,
	sendRequest,
	setIdleTimeout,
	shutdownAll,
	shutdownClient,
	syncContent,
	WARMUP_TIMEOUT_MS,
} from "./client.js";
export { getServersForLanguage, isCommandAvailable, loadLspServers, resolveCommand } from "./config.js";
export { detectLanguageIdFromPath } from "./detection.js";
export {
	createLanguageEncounterCoordinator,
	type LanguageEncounterCoordinator,
	type LanguageEncounterResult,
} from "./encounter.js";
export {
	type EnsureServerInstalledOptions,
	type EnsureServerInstalledResult,
	ensureServerInstalled,
	type InstallCommandResult,
	type InstallCommandRunner,
	runInstallCommand,
} from "./installer.js";
export {
	detectLspmux,
	getLspmuxCommand,
	invalidateLspmuxCache,
	isLspmuxActive,
	isLspmuxSupported,
	wrapWithLspmux,
} from "./lspmux.js";
export { type PlanLanguageEncounterInput, planLanguageEncounter } from "./planner.js";
export type {
	InstallerDefinition,
	InstallerKind,
	LspClient,
	LspClientTransport,
	LspConfigFile,
	LspJsonRpcNotification,
	LspJsonRpcRequest,
	LspJsonRpcResponse,
	LspmuxState,
	LspmuxWrappedCommand,
	LspPlannerAction,
	LspPlannerResult,
	LspServerDefinition,
	LspServerStatus,
	OpenFileState,
	PendingLspRequest,
	ResolvedLspServer,
	ServerConfig,
} from "./types.js";
