import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { resolveHooksConfig } from "../src/core/hooks/index.js";

const tempDirs: string[] = [];

function createTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-hooks-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("resolveHooksConfig", () => {
	test("uses cli config when both cli and env are present", async () => {
		const dir = createTempDir();
		const configPath = join(dir, "hooks.json");
		writeFileSync(
			configPath,
			JSON.stringify({
				SessionStart: [{ command: "echo cli" }],
			}),
		);

		const result = await resolveHooksConfig({
			hooksConfigPath: configPath,
			hooksJson: JSON.stringify({
				PreCompact: [{ command: "echo env" }],
			}),
		});

		expect(result.sourceName).toBe("cli");
		expect(result.config?.SessionStart?.[0].command).toBe("echo cli");
		expect(result.config?.PreCompact).toBeUndefined();
	});

	test("uses env config when cli is not provided", async () => {
		const result = await resolveHooksConfig({
			hooksJson: JSON.stringify({
				PreToolUse: [{ command: "echo env guard" }],
			}),
		});

		expect(result.sourceName).toBe("env");
		expect(result.config?.PreToolUse?.[0].command).toBe("echo env guard");
	});

	test("stops on cli source error and reports diagnostics", async () => {
		const dir = createTempDir();
		const configPath = join(dir, "invalid-hooks.json");
		writeFileSync(configPath, "{");

		const result = await resolveHooksConfig({
			hooksConfigPath: configPath,
			hooksJson: JSON.stringify({
				SessionStart: [{ command: "echo fallback" }],
			}),
		});

		expect(result.sourceName).toBe("cli");
		expect(result.config).toBeUndefined();
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("[cli]");
	});
});
