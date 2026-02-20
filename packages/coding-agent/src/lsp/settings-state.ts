import { isCommandAvailable, loadLspServers } from "./config.js";
import type { ResolvedLspServer } from "./types.js";

export interface PersistedLspServerState {
	enabled?: boolean;
	installed?: boolean;
}

export interface LspServerSettingsState {
	name: string;
	command: string;
	enabled?: boolean;
	installed: boolean;
	canInstall: boolean;
	manualRemediation?: string;
}

export interface BuildLspServerSettingsStateOptions {
	cwd: string;
	resolvedServers?: Record<string, ResolvedLspServer>;
	getPersistedState: (serverName: string) => PersistedLspServerState;
	commandAvailable?: (command: string, cwd: string) => boolean;
}

export function buildLspServerSettingsState(options: BuildLspServerSettingsStateOptions): LspServerSettingsState[] {
	const commandAvailable = options.commandAvailable ?? isCommandAvailable;
	const servers = options.resolvedServers ?? loadLspServers(options.cwd, { respectRuntimeEnabled: false });
	return Object.values(servers)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((server) => {
			const persisted = options.getPersistedState(server.name);
			const detectedInstalled = commandAvailable(server.command, options.cwd);
			const canInstall = Boolean(server.installer && server.installer.kind !== "unsupported");
			return {
				name: server.name,
				command: server.command,
				enabled: persisted.enabled,
				installed: detectedInstalled || persisted.installed === true,
				canInstall,
				manualRemediation: canInstall ? undefined : server.installer?.remediation,
			};
		});
}
