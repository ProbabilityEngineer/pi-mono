import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLspServers } from "../src/lsp/config.js";

describe("lsp config TypeScript tuning", () => {
	it("loads TypeScript initOptions defaults", () => {
		const servers = loadLspServers(process.cwd());
		const tsServer = servers["typescript-language-server"];
		expect(tsServer).toBeDefined();
		expect(tsServer?.initOptions).toEqual({
			hostInfo: "pi-coding-agent",
			preferences: {
				includeInlayParameterNameHints: "all",
				includeInlayVariableTypeHints: true,
				includeInlayFunctionParameterTypeHints: true,
			},
		});
	});

	it("allows overriding TypeScript initOptions via lsp.json", () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-lsp-ts-tuning-"));
		try {
			writeFileSync(
				join(dir, "lsp.json"),
				JSON.stringify(
					{
						servers: {
							"typescript-language-server": {
								initOptions: {
									hostInfo: "custom-host",
									preferences: {
										includeInlayParameterNameHints: "none",
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
				hostInfo: "custom-host",
				preferences: {
					includeInlayParameterNameHints: "none",
				},
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
