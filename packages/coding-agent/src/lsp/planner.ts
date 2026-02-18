import { type CommandAvailabilityOptions, getServersForLanguage, isCommandAvailable } from "./config.js";
import type { LspPlannerResult } from "./types.js";

export interface PlanLanguageEncounterInput {
	cwd: string;
	languageId: string | undefined;
	languageEnabled: boolean;
	autoEnableOnEncounter: boolean;
	autoInstallOnEncounter: boolean;
}

export interface PlanLanguageEncounterOptions {
	commandAvailabilityOptions?: CommandAvailabilityOptions;
	commandAvailable?: (command: string, cwd: string) => boolean;
}

export function planLanguageEncounter(
	input: PlanLanguageEncounterInput,
	options: PlanLanguageEncounterOptions = {},
): LspPlannerResult {
	if (!input.languageId) {
		return {
			action: "none",
			languageId: "unknown",
			skippedReason: "no_language",
		};
	}

	const servers = getServersForLanguage(input.languageId, input.cwd);
	const server = servers[0];
	if (!server) {
		return {
			action: "none",
			languageId: input.languageId,
			skippedReason: "no_server",
		};
	}

	const commandAvailable =
		options.commandAvailable ??
		((command: string, commandCwd: string) =>
			isCommandAvailable(command, commandCwd, options.commandAvailabilityOptions));
	const available = commandAvailable(server.command, input.cwd);
	if (input.languageEnabled) {
		if (available) {
			return {
				action: "none",
				languageId: input.languageId,
				server,
				skippedReason: "already_enabled_and_available",
			};
		}
		if (!input.autoInstallOnEncounter) {
			return {
				action: "none",
				languageId: input.languageId,
				server,
				skippedReason: "auto_install_disabled",
			};
		}
		return {
			action: "install_then_enable",
			languageId: input.languageId,
			server,
		};
	}

	if (!input.autoEnableOnEncounter) {
		return {
			action: "none",
			languageId: input.languageId,
			server,
			skippedReason: "auto_enable_disabled",
		};
	}

	if (available) {
		return {
			action: "enable_only",
			languageId: input.languageId,
			server,
		};
	}

	if (!input.autoInstallOnEncounter) {
		return {
			action: "none",
			languageId: input.languageId,
			server,
			skippedReason: "auto_install_disabled",
		};
	}

	return {
		action: "install_then_enable",
		languageId: input.languageId,
		server,
	};
}
