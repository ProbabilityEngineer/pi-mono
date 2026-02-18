import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ensureServerInstalled } from "../src/lsp/installer.js";
import type { ResolvedLspServer } from "../src/lsp/types.js";

const tsServer: ResolvedLspServer = {
	name: "typescript-language-server",
	command: "typescript-language-server",
	languages: ["typescript"],
	installer: { kind: "npm", package: "typescript-language-server" },
};

function createSpawnResult(overrides: Partial<SpawnSyncReturns<Buffer>> = {}): SpawnSyncReturns<Buffer> {
	return {
		pid: 1,
		output: [null, Buffer.alloc(0), Buffer.alloc(0)],
		stdout: Buffer.alloc(0),
		stderr: Buffer.alloc(0),
		status: 0,
		signal: null,
		...overrides,
	};
}

describe("lsp installer", () => {
	it("returns already_installed when command is available", async () => {
		const result = await ensureServerInstalled("/tmp", tsServer, {
			commandAvailable: () => true,
		});

		expect(result.status).toBe("already_installed");
		expect(result.installed).toBe(false);
	});

	it("returns installed when install command succeeds and binary appears", async () => {
		let available = false;
		const result = await ensureServerInstalled("/tmp", tsServer, {
			commandAvailable: () => available,
			commandRunner: async () => {
				available = true;
				return { exitCode: 0, stdout: "", stderr: "" };
			},
		});

		expect(result.status).toBe("installed");
		expect(result.installed).toBe(true);
	});

	it("returns failed when install command fails", async () => {
		const result = await ensureServerInstalled("/tmp", tsServer, {
			commandAvailable: () => false,
			commandRunner: async () => ({ exitCode: 1, stdout: "", stderr: "npm failed" }),
		});

		expect(result.status).toBe("failed");
		expect(result.error).toContain("npm failed");
		expect(result.remediation).toContain("npm install");
	});

	it("returns unsupported with remediation when installer is unsupported", async () => {
		const result = await ensureServerInstalled(
			"/tmp",
			{
				name: "rust-analyzer",
				command: "rust-analyzer",
				languages: ["rust"],
				installer: { kind: "unsupported", remediation: "install rust-analyzer manually" },
			},
			{
				commandAvailable: () => false,
				commandRunner: vi.fn(),
			},
		);

		expect(result.status).toBe("unsupported");
		expect(result.remediation).toContain("install rust-analyzer manually");
	});

	it("uses probe-backed gating and fails if command remains non-runnable", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "lsp-installer-win-test-"));
		try {
			const binDir = join(cwd, "bin");
			mkdirSync(binDir, { recursive: true });
			writeFileSync(join(binDir, "typescript-language-server.cmd"), "@echo off\r\n");
			const probeRunner = vi.fn(() =>
				createSpawnResult({
					error: Object.assign(new Error("spawn blocked"), { code: "EACCES" }),
					status: null,
				}),
			);

			const result = await ensureServerInstalled(cwd, tsServer, {
				commandAvailabilityOptions: {
					platform: "win32",
					envPath: binDir,
					pathExt: ".CMD",
					commandProbeRunner: probeRunner,
				},
				commandRunner: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
			});

			expect(result.status).toBe("failed");
			expect(result.error).toContain("still unavailable");
			expect(probeRunner).toHaveBeenCalledTimes(2);
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
});
