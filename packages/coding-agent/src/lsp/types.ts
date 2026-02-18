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
