import { describe, expect, it, vi } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.js";
import { createLanguageEncounterCoordinator } from "../src/lsp/encounter.js";
import type { EnsureServerInstalledResult } from "../src/lsp/installer.js";
import type { PlanLanguageEncounterInput } from "../src/lsp/planner.js";

describe("language encounter coordinator", () => {
	it("enables language without install when planner returns enable_only", async () => {
		const settings = SettingsManager.inMemory();
		const planner = vi.fn((_input: PlanLanguageEncounterInput) => ({
			action: "enable_only" as const,
			languageId: "typescript",
			server: {
				name: "typescript-language-server",
				command: "typescript-language-server",
				languages: ["typescript"],
			},
		}));
		const ensureInstalled = vi.fn();
		const coordinator = createLanguageEncounterCoordinator("/tmp", settings, {
			detectLanguageId: () => "typescript",
			planner,
			ensureInstalled,
		});

		const result = await coordinator.handlePath("src/index.ts");
		expect(result?.enabled).toBe(true);
		expect(settings.getLspLanguageEnabled("typescript")).toBe(true);
		expect(ensureInstalled).not.toHaveBeenCalled();
	});

	it("installs then enables when installer succeeds", async () => {
		const settings = SettingsManager.inMemory();
		const coordinator = createLanguageEncounterCoordinator("/tmp", settings, {
			detectLanguageId: () => "typescript",
			planner: () => ({
				action: "install_then_enable",
				languageId: "typescript",
				server: {
					name: "typescript-language-server",
					command: "typescript-language-server",
					languages: ["typescript"],
				},
			}),
			ensureInstalled: async () =>
				({
					server: "typescript-language-server",
					command: "typescript-language-server",
					status: "installed",
					installed: true,
				}) as EnsureServerInstalledResult,
		});

		const result = await coordinator.handlePath("src/index.ts");
		expect(result?.installed).toBe(true);
		expect(result?.enabled).toBe(true);
		expect(settings.getLspLanguageEnabled("typescript")).toBe(true);
	});

	it("returns remediation and suppresses repeated attempts in one session", async () => {
		const settings = SettingsManager.inMemory();
		const ensureInstalled = vi.fn(
			async () =>
				({
					server: "pyright",
					command: "pyright-langserver",
					status: "failed",
					installed: false,
					error: "pip failed",
					remediation: "install pyright manually",
				}) as EnsureServerInstalledResult,
		);
		const coordinator = createLanguageEncounterCoordinator("/tmp", settings, {
			detectLanguageId: () => "python",
			planner: () => ({
				action: "install_then_enable",
				languageId: "python",
				server: { name: "pyright", command: "pyright-langserver", languages: ["python"] },
			}),
			ensureInstalled,
		});

		const first = await coordinator.handlePath("src/main.py");
		const second = await coordinator.handlePath("src/main.py");
		expect(first?.enabled).toBe(false);
		expect(first?.remediation).toContain("install pyright manually");
		expect(second?.skippedReason).toBe("already_attempted_this_session");
		expect(ensureInstalled).toHaveBeenCalledTimes(1);
	});
});
