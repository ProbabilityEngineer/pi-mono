import type { InstallCommandRunner } from "../lsp/installer.js";

export interface EnsureAstGrepInstalledOptions {
	commandRunner?: InstallCommandRunner;
	commandAvailable?: (command: string, cwd: string) => boolean;
	timeoutMs?: number;
	platform?: NodeJS.Platform;
}

export interface EnsureAstGrepInstalledResult {
	command: "sg" | "ast-grep";
	status: "already_installed" | "installed" | "failed" | "unsupported";
	installed: boolean;
	remediation?: string;
	error?: string;
}

export interface AstGrepSettingsState {
	available: boolean;
	command: "sg" | "ast-grep";
	canInstall: boolean;
	manualRemediation: string;
}
