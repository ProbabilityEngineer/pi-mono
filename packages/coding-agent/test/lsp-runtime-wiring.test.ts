import { describe, expect, it } from "vitest";
import { createExtensionRuntime } from "../src/core/extensions/loader.js";
import type { ResourceLoader } from "../src/core/resource-loader.js";
import { createAgentSession } from "../src/core/sdk.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";
import { createAllTools } from "../src/core/tools/index.js";

function createEmptyResourceLoader(): ResourceLoader {
	return {
		getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
		getSkills: () => ({ skills: [], diagnostics: [] }),
		getPrompts: () => ({ prompts: [], diagnostics: [] }),
		getThemes: () => ({ themes: [], diagnostics: [] }),
		getAgentsFiles: () => ({ agentsFiles: [] }),
		getSystemPrompt: () => undefined,
		getAppendSystemPrompt: () => [],
		getPathMetadata: () => new Map(),
		extendResources: () => {},
		reload: async () => {},
	};
}

describe("lsp runtime wiring", () => {
	it("registers lsp in base tool factory", () => {
		const tools = createAllTools(process.cwd());
		expect(tools.lsp).toBeDefined();
	});

	it("includes lsp in active tools when lsp.enabled is true", async () => {
		const { session } = await createAgentSession({
			cwd: process.cwd(),
			sessionManager: SessionManager.inMemory(),
			resourceLoader: createEmptyResourceLoader(),
			settingsManager: SettingsManager.inMemory({ lsp: { enabled: true } }),
		});

		expect(session.getActiveToolNames()).toContain("lsp");
		expect(session.getAllTools().some((tool) => tool.name === "lsp")).toBe(true);
	});

	it("gates lsp out when lsp.enabled is false", async () => {
		const { session } = await createAgentSession({
			cwd: process.cwd(),
			sessionManager: SessionManager.inMemory(),
			resourceLoader: createEmptyResourceLoader(),
			settingsManager: SettingsManager.inMemory({ lsp: { enabled: false } }),
		});

		expect(session.getActiveToolNames()).not.toContain("lsp");
		expect(session.getAllTools().some((tool) => tool.name === "lsp")).toBe(false);
	});
});
