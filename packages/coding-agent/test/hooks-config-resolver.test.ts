import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
		expect(result.invalidRuntimeConfig).toBe(false);
		expect(result.hooksDisabledForSession).toBe(false);
		expect(result.diagnostics).toEqual([]);
	});

	test("uses env config when cli is not provided", async () => {
		const result = await resolveHooksConfig({
			hooksJson: JSON.stringify({
				PreToolUse: [{ command: "echo env guard" }],
			}),
		});

		expect(result.sourceName).toBe("env");
		expect(result.config?.PreToolUse?.[0].command).toBe("echo env guard");
		expect(result.invalidRuntimeConfig).toBe(false);
		expect(result.hooksDisabledForSession).toBe(false);
		expect(result.diagnostics).toEqual([]);
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
		expect(result.invalidRuntimeConfig).toBe(true);
		expect(result.hooksDisabledForSession).toBe(true);
		expect(result.invalidRuntimeSourceName).toBe("cli");
		expect(result.invalidRuntimeReason).toBe("invalid JSON");
		expect(result.diagnostics).toEqual([
			expect.objectContaining({
				sourceName: "cli",
				isRuntimeSource: true,
			}),
		]);
	});

	test("loads hooks from .claude/settings.local.json when loader is enabled", async () => {
		const dir = createTempDir();
		const claudeDir = join(dir, ".claude");
		mkdirSync(claudeDir, { recursive: true });
		writeFileSync(
			join(claudeDir, "settings.local.json"),
			JSON.stringify({
				hooks: {
					PreToolUse: [
						{
							matcher: "bash",
							hooks: [{ type: "command", command: "echo from-claude" }],
						},
					],
				},
			}),
		);

		const result = await resolveHooksConfig({
			cwd: dir,
			enableClaudeSettingsLoader: true,
		});

		expect(result.sourceName).toBe("claude_settings");
		expect(result.config?.PreToolUse?.[0].command).toBe("echo from-claude");
		expect(result.config?.PreToolUse?.[0].matcher?.toolNames).toEqual(["bash"]);
		expect(result.invalidRuntimeConfig).toBe(false);
		expect(result.hooksDisabledForSession).toBe(false);
		expect(result.diagnostics).toEqual([]);
	});

	test("uses claude loader when env config is absent and loader is enabled", async () => {
		const dir = createTempDir();
		const claudeDir = join(dir, ".claude");
		mkdirSync(claudeDir, { recursive: true });
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({
				hooks: {
					SessionStart: [
						{
							matcher: "*",
							hooks: [{ type: "command", command: "echo claude-start" }],
						},
					],
				},
			}),
		);

		const result = await resolveHooksConfig({
			cwd: dir,
			enableClaudeSettingsLoader: true,
			gastownMode: true,
		});

		expect(result.sourceName).toBe("claude_settings");
		expect(result.config?.SessionStart?.[0].command).toBe("echo claude-start");
		expect(result.invalidRuntimeConfig).toBe(false);
		expect(result.hooksDisabledForSession).toBe(false);
		expect(result.diagnostics).toEqual([]);
	});

	test("does not fall back to gastown defaults when runtime config is invalid", async () => {
		const result = await resolveHooksConfig({
			hooksJson: "{",
			gastownMode: true,
		});

		expect(result.sourceName).toBe("env");
		expect(result.config).toBeUndefined();
		expect(result.invalidRuntimeConfig).toBe(true);
		expect(result.hooksDisabledForSession).toBe(true);
	});

	test("disables hooks when cli config path is missing", async () => {
		const dir = createTempDir();
		const missingPath = join(dir, "missing-hooks.json");
		const result = await resolveHooksConfig({
			hooksConfigPath: missingPath,
			gastownMode: true,
		});

		expect(result.sourceName).toBe("cli");
		expect(result.config).toBeUndefined();
		expect(result.invalidRuntimeConfig).toBe(true);
		expect(result.hooksDisabledForSession).toBe(true);
		expect(result.invalidRuntimeReason).toBe("hooks config file not found");
		expect(result.errors[0]).toContain("[cli]");
	});
});
