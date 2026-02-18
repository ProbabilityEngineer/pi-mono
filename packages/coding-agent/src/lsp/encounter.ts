import type { SettingsManager } from "../core/settings-manager.js";
import { detectLanguageIdFromPath } from "./detection.js";
import { type EnsureServerInstalledResult, ensureServerInstalled } from "./installer.js";
import { planLanguageEncounter } from "./planner.js";

export interface LanguageEncounterResult {
	language: string;
	server?: string;
	installed: boolean;
	enabled: boolean;
	skippedReason?: string;
	error?: string;
	remediation?: string;
}

export interface LanguageEncounterCoordinator {
	handlePath(filePath: string): Promise<LanguageEncounterResult | undefined>;
}

export interface LanguageEncounterCoordinatorOptions {
	detectLanguageId?: (filePath: string) => string | undefined;
	planner?: typeof planLanguageEncounter;
	ensureInstalled?: typeof ensureServerInstalled;
}

export function createLanguageEncounterCoordinator(
	cwd: string,
	settingsManager: SettingsManager,
	options: LanguageEncounterCoordinatorOptions = {},
): LanguageEncounterCoordinator {
	const attemptedInSession = new Set<string>();
	const detectLanguageId = options.detectLanguageId ?? detectLanguageIdFromPath;
	const planner = options.planner ?? planLanguageEncounter;
	const ensureInstalled = options.ensureInstalled ?? ensureServerInstalled;

	return {
		async handlePath(filePath: string): Promise<LanguageEncounterResult | undefined> {
			const languageId = detectLanguageId(filePath);
			if (!languageId) {
				return undefined;
			}

			const plan = planner({
				cwd,
				languageId,
				languageEnabled: settingsManager.getLspLanguageEnabled(languageId),
				autoEnableOnEncounter: settingsManager.getLspAutoEnableOnEncounter(),
				autoInstallOnEncounter: settingsManager.getLspAutoInstallOnEncounter(),
			});

			if (!plan.server) {
				return {
					language: languageId,
					installed: false,
					enabled: settingsManager.getLspLanguageEnabled(languageId),
					skippedReason: plan.skippedReason,
				};
			}

			const attemptKey = `${languageId}:${plan.server.name}`;
			if (attemptedInSession.has(attemptKey)) {
				return {
					language: languageId,
					server: plan.server.name,
					installed: false,
					enabled: settingsManager.getLspLanguageEnabled(languageId),
					skippedReason: "already_attempted_this_session",
				};
			}

			if (plan.action === "none") {
				return {
					language: languageId,
					server: plan.server.name,
					installed: false,
					enabled: settingsManager.getLspLanguageEnabled(languageId),
					skippedReason: plan.skippedReason,
				};
			}

			if (plan.action === "enable_only") {
				settingsManager.setProjectLspLanguageEnabled(languageId, true);
				attemptedInSession.add(attemptKey);
				return {
					language: languageId,
					server: plan.server.name,
					installed: false,
					enabled: true,
				};
			}

			const installResult: EnsureServerInstalledResult = await ensureInstalled(cwd, plan.server);
			if (installResult.status === "installed" || installResult.status === "already_installed") {
				settingsManager.setProjectLspLanguageEnabled(languageId, true);
				attemptedInSession.add(attemptKey);
				return {
					language: languageId,
					server: plan.server.name,
					installed: installResult.status === "installed",
					enabled: true,
				};
			}

			attemptedInSession.add(attemptKey);
			return {
				language: languageId,
				server: plan.server.name,
				installed: false,
				enabled: false,
				skippedReason: installResult.status,
				error: installResult.error,
				remediation: installResult.remediation,
			};
		},
	};
}
