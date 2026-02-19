import { describe, expect, test } from "vitest";
import { buildInvalidHookConfigWarning, buildInvalidHookConfigWarningDetails } from "../src/core/hooks/startup-warning.js";

describe("hooks invalid-config startup warning", () => {
	test("includes source, reason, and disabled-hooks action", () => {
		const message = buildInvalidHookConfigWarning({
			config: undefined,
			sourceName: "cli",
			errors: [],
			diagnostics: [],
			invalidRuntimeConfig: true,
			invalidRuntimeSourceName: "cli",
			invalidRuntimeReason: "missing file",
			hooksDisabledForSession: true,
		});
		expect(message).toBe(
			"Warning: invalid hook config from cli (missing file). Hooks are disabled for this session.",
		);
	});

	test("builds structured details for verbose mode", () => {
		const details = buildInvalidHookConfigWarningDetails({
			config: undefined,
			sourceName: "env",
			errors: ["[env] invalid JSON"],
			diagnostics: [{ sourceName: "env", message: "invalid JSON", isRuntimeSource: true }],
			invalidRuntimeConfig: true,
			invalidRuntimeSourceName: "env",
			invalidRuntimeReason: "invalid JSON",
			hooksDisabledForSession: true,
		});

		expect(details).toEqual({
			type: "invalid_hook_config",
			source: "env",
			reason: "invalid JSON",
			hooksDisabledForSession: true,
			errors: ["[env] invalid JSON"],
			diagnostics: [{ sourceName: "env", message: "invalid JSON", isRuntimeSource: true }],
		});
	});
});
