import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { describe, expect, test } from "vitest";
import type { ExtensionRunner } from "../src/core/extensions/index.js";
import { wrapToolWithExtensions } from "../src/core/extensions/wrapper.js";
import type { HookPostToolUseResult, HookPreToolUseResult, HookRunner } from "../src/core/hooks/index.js";

class HookRunnerStub {
	readonly calls: string[] = [];
	block = false;

	async runPreToolUse(): Promise<HookPreToolUseResult> {
		this.calls.push("pre");
		return {
			blocked: this.block,
			reason: this.block ? "blocked by pre hook" : undefined,
			invocations: [],
		};
	}

	async runPostToolUse(): Promise<HookPostToolUseResult> {
		this.calls.push("post");
		return {
			invocations: [],
		};
	}
}

function createRunnerStub(): ExtensionRunner {
	const runner = {
		hasHandlers: () => false,
		emitToolCall: async () => undefined,
		emitToolResult: async () => undefined,
	} satisfies Partial<ExtensionRunner>;
	return runner as unknown as ExtensionRunner;
}

function createTool(execute: AgentTool["execute"]): AgentTool {
	return {
		name: "bash",
		label: "bash",
		description: "test tool",
		parameters: {
			...Type.Object({}),
		},
		execute,
	};
}

describe("hook lifecycle in wrapToolWithExtensions", () => {
	test("runs pre and post hooks around tool execution", async () => {
		const hookRunner = new HookRunnerStub();
		const order: string[] = [];
		const tool = createTool(async () => {
			order.push("tool");
			const result: AgentToolResult<unknown> = { content: [{ type: "text", text: "ok" }], details: {} };
			return result;
		});

		const wrapped = wrapToolWithExtensions(tool, createRunnerStub(), {
			hookRunner: hookRunner as unknown as HookRunner,
			cwd: process.cwd(),
		});
		await wrapped.execute("tool-use-1", {}, undefined, undefined);

		expect(hookRunner.calls).toEqual(["pre", "post"]);
		expect(order).toEqual(["tool"]);
	});

	test("blocks tool execution when pre hook blocks", async () => {
		const hookRunner = new HookRunnerStub();
		hookRunner.block = true;
		let executed = false;
		const tool = createTool(async () => {
			executed = true;
			const result: AgentToolResult<unknown> = { content: [{ type: "text", text: "ok" }], details: {} };
			return result;
		});

		const wrapped = wrapToolWithExtensions(tool, createRunnerStub(), {
			hookRunner: hookRunner as unknown as HookRunner,
			cwd: process.cwd(),
		});

		await expect(wrapped.execute("tool-use-2", {}, undefined, undefined)).rejects.toThrow("blocked by pre hook");
		expect(executed).toBe(false);
		expect(hookRunner.calls).toEqual(["pre"]);
	});

	test("runs post hook even when tool throws", async () => {
		const hookRunner = new HookRunnerStub();
		const tool = createTool(async () => {
			throw new Error("tool failed");
		});

		const wrapped = wrapToolWithExtensions(tool, createRunnerStub(), {
			hookRunner: hookRunner as unknown as HookRunner,
			cwd: process.cwd(),
		});

		await expect(wrapped.execute("tool-use-3", {}, undefined, undefined)).rejects.toThrow("tool failed");
		expect(hookRunner.calls).toEqual(["pre", "post"]);
	});
});
