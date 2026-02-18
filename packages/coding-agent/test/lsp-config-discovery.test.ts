import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLspServers } from "../src/lsp/config.js";

function createDir(): string {
	return mkdtempSync(join(tmpdir(), "pi-lsp-config-discovery-"));
}

describe("lsp config discovery", () => {
	it("loads lsp.yaml from project root", () => {
		const dir = createDir();
		try {
			writeFileSync(
				join(dir, "lsp.yaml"),
				`servers:
  typescript-language-server:
    rootMarkers:
      - package.json
      - tsconfig.json
`,
				"utf8",
			);

			const servers = loadLspServers(dir);
			expect(servers["typescript-language-server"]?.rootMarkers).toEqual(["package.json", "tsconfig.json"]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("loads .pi/lsp.yml when root config is absent", () => {
		const dir = createDir();
		try {
			mkdirSync(join(dir, ".pi"), { recursive: true });
			writeFileSync(
				join(dir, ".pi", "lsp.yml"),
				`servers:
  typescript-language-server:
    isLinter: true
`,
				"utf8",
			);

			const servers = loadLspServers(dir);
			expect(servers["typescript-language-server"]?.isLinter).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("loads .config/pi/lsp.json when root and .pi configs are absent", () => {
		const dir = createDir();
		try {
			mkdirSync(join(dir, ".config", "pi"), { recursive: true });
			writeFileSync(
				join(dir, ".config", "pi", "lsp.json"),
				JSON.stringify(
					{
						servers: {
							"typescript-language-server": {
								settings: {
									typescript: {
										format: { enable: false },
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
			expect(servers["typescript-language-server"]?.settings).toEqual({
				typescript: {
					format: { enable: false },
				},
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("skips invalid config and falls back to next candidate", () => {
		const dir = createDir();
		try {
			writeFileSync(join(dir, "lsp.yaml"), "not: [valid", "utf8");
			mkdirSync(join(dir, ".pi"), { recursive: true });
			writeFileSync(
				join(dir, ".pi", "lsp.json"),
				JSON.stringify(
					{
						servers: {
							"typescript-language-server": {
								rootMarkers: [".pi-marker"],
							},
						},
					},
					null,
					2,
				),
				"utf8",
			);

			const servers = loadLspServers(dir);
			expect(servers["typescript-language-server"]?.rootMarkers).toEqual([".pi-marker"]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
