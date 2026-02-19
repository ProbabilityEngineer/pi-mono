import { describe, expect, test } from "vitest";
import { HOOK_EVENT_NAMES, parseHooksConfig } from "../src/core/hooks/index.js";

describe("parseHooksConfig", () => {
	test("parses all supported hook events", () => {
		const input = {
			SessionStart: [{ command: "echo session" }],
			PreToolUse: [{ command: "echo pre", matcher: { toolNames: ["bash", "read"] } }],
			PostToolUse: [{ command: "echo post", timeoutMs: 1200 }],
			PostToolUseFailure: [{ command: "echo postfail" }],
			PreCompact: [{ command: "echo compact", failOpen: false }],
		};

		const config = parseHooksConfig(input);
		expect(Object.keys(config).sort()).toEqual([...HOOK_EVENT_NAMES].sort());
		expect(config.PreToolUse?.[0].matcher?.toolNames).toEqual(["bash", "read"]);
		expect(config.PostToolUse?.[0].timeoutMs).toBe(1200);
		expect(config.PostToolUseFailure?.[0].command).toBe("echo postfail");
		expect(config.PreCompact?.[0].failOpen).toBe(false);
	});

	test("rejects unknown hook events", () => {
		expect(() =>
			parseHooksConfig({
				UnknownEvent: [{ command: "echo nope" }],
			}),
		).toThrow("unsupported hook event");
	});

	test("rejects invalid command and matcher shapes", () => {
		expect(() =>
			parseHooksConfig({
				SessionStart: [{ command: "" }],
			}),
		).toThrow("non-empty string");

		expect(() =>
			parseHooksConfig({
				PreToolUse: [{ command: "echo guard", matcher: { toolNames: [1, 2, 3] } }],
			}),
		).toThrow("array of strings");
	});
});
