import { describe, expect, it } from "vitest";
import { buildLspServerSettingsState } from "../src/lsp/settings-state.js";
import type { ResolvedLspServer } from "../src/lsp/types.js";

describe("lsp settings state", () => {
	it("derives install state from command probes and preserves persisted enablement", () => {
		const servers: Record<string, ResolvedLspServer> = {
			"sourcekit-lsp": {
				name: "sourcekit-lsp",
				command: "sourcekit-lsp",
				languages: ["swift"],
			},
			basedpyright: {
				name: "basedpyright",
				command: "basedpyright-langserver",
				languages: ["python"],
			},
		};
		const result = buildLspServerSettingsState({
			cwd: "/tmp",
			resolvedServers: servers,
			getPersistedState: (serverName) => (serverName === "basedpyright" ? { enabled: false } : {}),
			commandAvailable: (command) => command === "sourcekit-lsp",
		});

		expect(result).toEqual([
			{
				name: "basedpyright",
				command: "basedpyright-langserver",
				enabled: false,
				installed: false,
				canInstall: false,
			},
			{
				name: "sourcekit-lsp",
				command: "sourcekit-lsp",
				enabled: undefined,
				installed: true,
				canInstall: false,
			},
		]);
	});

	it("keeps installed=true when persisted state exists but probe is unavailable", () => {
		const servers: Record<string, ResolvedLspServer> = {
			"typescript-language-server": {
				name: "typescript-language-server",
				command: "typescript-language-server",
				languages: ["typescript"],
				installer: { kind: "npm", package: "typescript-language-server" },
			},
		};
		const result = buildLspServerSettingsState({
			cwd: "/tmp",
			resolvedServers: servers,
			getPersistedState: () => ({ installed: true }),
			commandAvailable: () => false,
		});

		expect(result[0]).toEqual({
			name: "typescript-language-server",
			command: "typescript-language-server",
			enabled: undefined,
			installed: true,
			canInstall: true,
		});
	});
});
