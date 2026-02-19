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
});
