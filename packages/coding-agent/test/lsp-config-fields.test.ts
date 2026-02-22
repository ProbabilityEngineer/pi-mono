import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLspServers } from "../src/lsp/config.js";

describe("lsp config field parity", () => {
	it("preserves default initOptions and supports lsp.json overrides for rootMarkers/isLinter/settings", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-lsp-config-fields-"));
		try {
			writeFileSync(
				join(dir, "lsp.json"),
				JSON.stringify(
					{
						servers: {
							"typescript-language-server": {
								rootMarkers: ["package.json", "tsconfig.json"],
								isLinter: false,
								settings: {
									typescript: {
										format: {
											enable: true,
										},
									},
								},
							},
						},
					},
					null,
					2,
				),
				"utf8",
			);

			const servers = loadLspServers(dir);
			expect(servers["typescript-language-server"]?.initOptions).toEqual({
				hostInfo: "pi-coding-agent",
				preferences: {
					includeInlayParameterNameHints: "all",
					includeInlayVariableTypeHints: true,
					includeInlayFunctionParameterTypeHints: true,
				},
			});
			expect(servers["typescript-language-server"]?.rootMarkers).toEqual(["package.json", "tsconfig.json"]);
			expect(servers["typescript-language-server"]?.isLinter).toBe(false);
			expect(servers["typescript-language-server"]?.settings).toEqual({
				typescript: {
					format: {
						enable: true,
					},
				},
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("supports custom override-only servers with rootMarkers/isLinter", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-lsp-config-custom-fields-"));
		try {
			mkdirSync(join(dir, ".pi"), { recursive: true });
			writeFileSync(
				join(dir, ".pi", "lsp.json"),
				JSON.stringify(
					{
						servers: {
							"custom-linter": {
								command: "custom-linter-lsp",
								args: ["--stdio"],
								languages: ["typescript"],
								rootMarkers: [".custom-linterrc"],
								isLinter: true,
							},
						},
					},
					null,
					2,
				),
				"utf8",
			);

			const servers = loadLspServers(dir);
			expect(servers["custom-linter"]).toMatchObject({
				name: "custom-linter",
				command: "custom-linter-lsp",
				args: ["--stdio"],
				languages: ["typescript"],
				rootMarkers: [".custom-linterrc"],
				isLinter: true,
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("applies persisted lsp server enablement from settings.json", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-lsp-config-settings-"));
		const agentDir = join(dir, "agent");
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		try {
			mkdirSync(agentDir, { recursive: true });
			process.env.PI_CODING_AGENT_DIR = agentDir;
			mkdirSync(join(dir, ".pi"), { recursive: true });

			writeFileSync(
				join(agentDir, "settings.json"),
				JSON.stringify(
					{
						lsp: {
							servers: {
								basedpyright: {
									enabled: false,
								},
							},
						},
					},
					null,
					2,
				),
				"utf8",
			);

			writeFileSync(
				join(dir, ".pi", "settings.json"),
				JSON.stringify(
					{
						lsp: {
							servers: {
								"sourcekit-lsp": {
									enabled: true,
								},
							},
						},
					},
					null,
					2,
				),
				"utf8",
			);

			const servers = loadLspServers(dir);
			expect(servers.basedpyright).toBeUndefined();
			expect(servers["sourcekit-lsp"]?.command).toBe("sourcekit-lsp");
		} finally {
			if (previousAgentDir === undefined) {
				delete process.env.PI_CODING_AGENT_DIR;
			} else {
				process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			}
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
