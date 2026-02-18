import type { SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type CommandProbeRunner,
	isCommandAvailable,
	probeCommandInvocation,
	resolveCommandOnPath,
} from "../src/lsp/config.js";

const createdDirs: string[] = [];

function createTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "lsp-config-win-test-"));
	createdDirs.push(dir);
	return dir;
}

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

afterEach(() => {
	for (const dir of createdDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("lsp windows command resolution", () => {
	it("resolves PATH entries with PATHEXT semantics", () => {
		const binDir = createTempDir();
		const commandPath = join(binDir, "typescript-language-server.cmd");
		writeFileSync(commandPath, "@echo off\r\necho ok\r\n");

		const resolved = resolveCommandOnPath("typescript-language-server", {
			platform: "win32",
			envPath: binDir,
			pathExt: ".CMD;.EXE",
		});
		expect(resolved).toBe(commandPath);
	});

	it("uses spawn-based probe on windows availability checks", () => {
		const binDir = createTempDir();
		const commandPath = join(binDir, "pyright-langserver.cmd");
		writeFileSync(commandPath, "@echo off\r\necho ok\r\n");

		const probeRunner = vi.fn(() => createSpawnResult({ error: undefined }));
		const available = isCommandAvailable("pyright-langserver", createTempDir(), {
			platform: "win32",
			envPath: binDir,
			pathExt: ".CMD",
			commandProbeRunner: probeRunner,
		});

		expect(available).toBe(true);
		expect(probeRunner).toHaveBeenCalledTimes(1);
	});

	it("returns unavailable when windows spawn probe fails with ENOENT", () => {
		const binDir = createTempDir();
		const commandPath = join(binDir, "gopls.cmd");
		writeFileSync(commandPath, "@echo off\r\necho ok\r\n");

		const err = Object.assign(new Error("spawn failed"), { code: "ENOENT" });
		const probeRunner = vi.fn(() => createSpawnResult({ error: err, status: null }));
		const available = isCommandAvailable("gopls", createTempDir(), {
			platform: "win32",
			envPath: binDir,
			pathExt: ".CMD",
			commandProbeRunner: probeRunner,
		});

		expect(available).toBe(false);
	});

	it("treats ETIMEDOUT probe errors as available", () => {
		const runner: CommandProbeRunner = () =>
			createSpawnResult({
				error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
				status: null,
				signal: "SIGTERM",
			});
		const available = probeCommandInvocation("typescript-language-server", createTempDir(), runner);
		expect(available).toBe(true);
	});
});
