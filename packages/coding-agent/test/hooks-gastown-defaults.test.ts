import { describe, expect, test } from "vitest";
import { buildGastownHookDefaults } from "../src/core/hooks/index.js";

describe("buildGastownHookDefaults", () => {
	test("returns SessionStart and PreToolUse hooks when gt exists", () => {
		const result = buildGastownHookDefaults({ gt: true, bd: false });
		expect(result?.SessionStart?.[0].command).toBe("gt prime");
		expect(result?.PreToolUse?.[0].command).toBe("gt tap guard");
		expect(result?.PreCompact).toBeUndefined();
	});

	test("returns PreCompact hook when bd exists", () => {
		const result = buildGastownHookDefaults({ gt: false, bd: true });
		expect(result?.PreCompact?.[0].command).toBe("bd sync");
		expect(result?.SessionStart).toBeUndefined();
	});

	test("returns undefined when neither gt nor bd exist", () => {
		const result = buildGastownHookDefaults({ gt: false, bd: false });
		expect(result).toBeUndefined();
	});
});
