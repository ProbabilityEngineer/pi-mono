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

		const probeRunner = vi.fn(() => ({ error: null }));
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
		const probeRunner = vi.fn(() => ({ error: err }));
		const available = isCommandAvailable("gopls", createTempDir(), {
			platform: "win32",
			envPath: binDir,
			pathExt: ".CMD",
			commandProbeRunner: probeRunner,
		});

		expect(available).toBe(false);
	});

	it("treats ETIMEDOUT probe errors as available", () => {
		const runner: CommandProbeRunner = () => ({
			error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
		});
		const available = probeCommandInvocation("typescript-language-server", createTempDir(), runner);
		expect(available).toBe(true);
	});
});
