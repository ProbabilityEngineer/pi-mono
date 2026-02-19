import { describe, expect, test } from "vitest";
import { redactSensitiveText } from "../src/core/hooks/index.js";

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
});
