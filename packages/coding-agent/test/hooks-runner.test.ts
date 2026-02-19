import { describe, expect, test } from "vitest";
import { HookRunner, type HooksConfigMap } from "../src/core/hooks/index.js";

describe("HookRunner", () => {
	test("runs SessionStart hooks once until reset", async () => {
		const config: HooksConfigMap = {
			SessionStart: [{ command: "printf 'hello'" }],
		};
		const runner = new HookRunner({ config });

		const first = await runner.runSessionStart(process.cwd());
		expect(first.invocations).toHaveLength(1);
		expect(first.additionalContext).toContain("hello");
		expect(first.invocations[0].durationMs).toBeGreaterThanOrEqual(0);

		const second = await runner.runSessionStart(process.cwd());
		expect(second.invocations).toHaveLength(0);
		expect(second.additionalContext).toBeUndefined();

		runner.resetSessionStart();
		const third = await runner.runSessionStart(process.cwd());
		expect(third.invocations).toHaveLength(1);
	});

	test("combines stdout and stderr into additional context", async () => {
		const config: HooksConfigMap = {
			SessionStart: [{ command: "printf 'a'; printf 'b' 1>&2" }],
		};
		const runner = new HookRunner({ config });
		const result = await runner.runSessionStart(process.cwd());

		expect(result.additionalContext).toBeDefined();
		expect(result.additionalContext).toContain("a");
		expect(result.additionalContext).toContain("b");
	});

	test("blocks PreToolUse on exit code 2", async () => {
		const config: HooksConfigMap = {
			PreToolUse: [{ command: "printf 'blocked'; exit 2" }],
		};
		const runner = new HookRunner({ config });
		const result = await runner.runPreToolUse(process.cwd(), "bash", {}, "tool-1");

		expect(result.blocked).toBe(true);
		expect(result.reason).toContain("blocked");
		expect(result.invocations[0].decision).toBe("deny");
		expect(result.invocations[0].reason).toContain("blocked");
	});

	test("fails open for non-zero PreToolUse by default", async () => {
		const config: HooksConfigMap = {
			PreToolUse: [{ command: "printf 'warn'; exit 1" }],
		};
		const runner = new HookRunner({ config });
		const result = await runner.runPreToolUse(process.cwd(), "bash", {}, "tool-2");

		expect(result.blocked).toBe(false);
		expect(result.invocations).toHaveLength(1);
		expect(result.invocations[0].failed).toBe(true);
		expect(result.invocations[0].decision).toBe("allow");
	});

	test("blocks on non-zero PreToolUse when failOpen is false", async () => {
		const config: HooksConfigMap = {
			PreToolUse: [{ command: "printf 'hard fail'; exit 1", failOpen: false }],
		};
		const runner = new HookRunner({ config });
		const result = await runner.runPreToolUse(process.cwd(), "bash", {}, "tool-3");

		expect(result.blocked).toBe(true);
		expect(result.reason).toContain("hard fail");
		expect(result.invocations[0].decision).toBe("deny");
	});

	test("attaches config source name to invocations", async () => {
		const config: HooksConfigMap = {
			SessionStart: [{ command: "printf 'hello'" }],
		};
		const runner = new HookRunner({ config, configSourceName: "env" });
		const result = await runner.runSessionStart(process.cwd());

		expect(result.invocations).toHaveLength(1);
		expect(result.invocations[0].configSourceName).toBe("env");
	});

	test("runs PostToolUseFailure hooks and captures output", async () => {
		const config: HooksConfigMap = {
			PostToolUseFailure: [{ command: "read payload; printf '%s' \"$payload\"" }],
		};
		const runner = new HookRunner({ config });
		const result = await runner.runPostToolUseFailure(
			process.cwd(),
			"bash",
			{ command: "exit 1" },
			"tool-4",
			"failed",
		);

		expect(result.invocations).toHaveLength(1);
		expect(result.invocations[0].eventName).toBe("PostToolUseFailure");
		expect(result.additionalContext).toContain('"hook_event_name":"PostToolUseFailure"');
		expect(result.additionalContext).toContain('"tool_error":"failed"');
	});
});
