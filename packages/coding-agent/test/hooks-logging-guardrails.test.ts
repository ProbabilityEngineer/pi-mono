import { describe, expect, test } from "vitest";
import { HOOK_LOG_MAX_CHARS, redactSensitiveText, truncateHookLogText } from "../src/core/hooks/index.js";

describe("redactSensitiveText", () => {
	test("redacts common token formats", () => {
		const input = "token=sk-abcdefghijklmnopqrstuvwxyz Bearer abcdefghijklmnop";
		const result = redactSensitiveText(input);

		expect(result.redacted).toBe(true);
		expect(result.value).toContain("[REDACTED]");
		expect(result.value).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
		expect(result.value).not.toContain("Bearer abcdefghijklmnop");
	});

	test("keeps non-secret text unchanged", () => {
		const input = "tool completed successfully";
		const result = redactSensitiveText(input);

		expect(result.redacted).toBe(false);
		expect(result.value).toBe(input);
	});

	test("truncates long log text with marker", () => {
		const input = "x".repeat(HOOK_LOG_MAX_CHARS + 50);
		const result = truncateHookLogText(input);

		expect(result.truncated).toBe(true);
		expect(result.value).toContain("...[truncated]");
	});
});
