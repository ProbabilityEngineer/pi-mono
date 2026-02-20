import { describe, expect, it } from "vitest";
import { canAutoInstallAstGrep, ensureAstGrepInstalled } from "../src/ast-grep/installer.js";

describe("ast-grep installer", () => {
	it("returns already_installed when sg is available", async () => {
		const result = await ensureAstGrepInstalled("/tmp", {
			commandAvailable: (command) => command === "sg",
		});

		expect(result.status).toBe("already_installed");
		expect(result.command).toBe("sg");
	});

	it("returns installed when install command succeeds and command appears", async () => {
		let available = false;
		const result = await ensureAstGrepInstalled("/tmp", {
			platform: "darwin",
			commandAvailable: () => available,
			commandRunner: async () => {
				available = true;
				return { exitCode: 0, stdout: "", stderr: "" };
			},
		});

		expect(result.status).toBe("installed");
		expect(result.installed).toBe(true);
		expect(result.command).toBe("sg");
	});

	it("returns failed when all install commands fail", async () => {
		const result = await ensureAstGrepInstalled("/tmp", {
			platform: "linux",
			commandAvailable: () => false,
			commandRunner: async () => ({ exitCode: 1, stdout: "", stderr: "install failed" }),
		});

		expect(result.status).toBe("failed");
		expect(result.error).toContain("install failed");
		expect(result.remediation).toContain("npm install -g @ast-grep/cli");
	});

	it("returns unsupported on unknown platforms", async () => {
		const result = await ensureAstGrepInstalled("/tmp", {
			platform: "aix",
			commandAvailable: () => false,
		});

		expect(result.status).toBe("unsupported");
		expect(result.remediation).toContain("Install ast-grep manually");
	});

	it("reports supported auto-install platforms", () => {
		expect(canAutoInstallAstGrep("darwin")).toBe(true);
		expect(canAutoInstallAstGrep("linux")).toBe(true);
		expect(canAutoInstallAstGrep("win32")).toBe(true);
		expect(canAutoInstallAstGrep("aix")).toBe(false);
	});
});
