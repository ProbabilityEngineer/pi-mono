import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectLanguageIdFromPath } from "../src/lsp/detection.js";
import { planLanguageEncounter } from "../src/lsp/planner.js";

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

describe("lsp detection", () => {
	it("maps common language extensions", () => {
		expect(detectLanguageIdFromPath("src/main.ts")).toBe("typescript");
		expect(detectLanguageIdFromPath("src/main.py")).toBe("python");
		expect(detectLanguageIdFromPath("src/main.rs")).toBe("rust");
		expect(detectLanguageIdFromPath("src/main.go")).toBe("go");
	});
});

describe("lsp planner", () => {
	let testDir: string;
	let originalPath: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `lsp-planner-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalPath = process.env.PATH;
		process.env.PATH = "";
	});

	afterEach(() => {
		process.env.PATH = originalPath;
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns none for unknown language", () => {
		const plan = planLanguageEncounter({
			cwd: testDir,
			languageId: undefined,
			languageEnabled: false,
			autoEnableOnEncounter: true,
			autoInstallOnEncounter: true,
		});
		expect(plan.action).toBe("none");
		expect(plan.skippedReason).toBe("no_language");
	});

	it("returns none when language is enabled and server is available", () => {
		const binDir = join(testDir, "bin");
		mkdirSync(binDir, { recursive: true });
		writeFileSync(join(binDir, "typescript-language-server"), "");
		process.env.PATH = binDir;

		const plan = planLanguageEncounter({
			cwd: testDir,
			languageId: "typescript",
			languageEnabled: true,
			autoEnableOnEncounter: true,
			autoInstallOnEncounter: true,
		});
		expect(plan.action).toBe("none");
		expect(plan.skippedReason).toBe("already_enabled_and_available");
	});

	it("returns enable_only when language is disabled and server is already available", () => {
		const binDir = join(testDir, "bin");
		mkdirSync(binDir, { recursive: true });
		writeFileSync(join(binDir, "typescript-language-server"), "");
		process.env.PATH = binDir;

		const plan = planLanguageEncounter({
			cwd: testDir,
			languageId: "typescript",
			languageEnabled: false,
			autoEnableOnEncounter: true,
			autoInstallOnEncounter: true,
		});
		expect(plan.action).toBe("enable_only");
	});

	it("returns install_then_enable when language is disabled and server is missing", () => {
		const plan = planLanguageEncounter({
			cwd: testDir,
			languageId: "typescript",
			languageEnabled: false,
			autoEnableOnEncounter: true,
			autoInstallOnEncounter: true,
		});
		expect(plan.action).toBe("install_then_enable");
	});

	it("returns none when auto-install is disabled", () => {
		const plan = planLanguageEncounter({
			cwd: testDir,
			languageId: "typescript",
			languageEnabled: false,
			autoEnableOnEncounter: true,
			autoInstallOnEncounter: false,
		});
		expect(plan.action).toBe("none");
		expect(plan.skippedReason).toBe("auto_install_disabled");
	});

	it("plans install when windows command exists but is not runnable", () => {
		const binDir = join(testDir, "bin");
		mkdirSync(binDir, { recursive: true });
		writeFileSync(join(binDir, "typescript-language-server.cmd"), "@echo off\r\n");
		const probeRunner = vi.fn(() =>
			createSpawnResult({
				error: Object.assign(new Error("spawn blocked"), { code: "EACCES" }),
				status: null,
			}),
		);

		const plan = planLanguageEncounter(
			{
				cwd: testDir,
				languageId: "typescript",
				languageEnabled: false,
				autoEnableOnEncounter: true,
				autoInstallOnEncounter: true,
			},
			{
				commandAvailabilityOptions: {
					platform: "win32",
					envPath: binDir,
					pathExt: ".CMD",
					commandProbeRunner: probeRunner,
				},
			},
		);
		expect(plan.action).toBe("install_then_enable");
		expect(probeRunner).toHaveBeenCalledTimes(1);
	});
});
