import { describe, expect, test } from "vitest";
import { DEFAULT_HOOK_TIMEOUT_MS, type HookCommandPayload, runHookCommand } from "../src/core/hooks/index.js";

const basePayload: HookCommandPayload = {
	hook_event_name: "SessionStart",
	cwd: process.cwd(),
};

describe("runHookCommand", () => {
	test("runs command via /bin/sh -lc and sends json payload on stdin", async () => {
		const result = await runHookCommand("read payload; printf '%s' \"$payload\"", {
			cwd: process.cwd(),
			payload: basePayload,
		});

		expect(result.code).toBe(0);
		expect(result.stdout).toContain('"hook_event_name":"SessionStart"');
		expect(result.timedOut).toBe(false);
	});

	test("captures stdout/stderr and exit code", async () => {
		const result = await runHookCommand("printf 'ok'; printf 'warn' 1>&2; exit 2", {
			cwd: process.cwd(),
			payload: basePayload,
		});

		expect(result.code).toBe(2);
		expect(result.stdout).toBe("ok");
		expect(result.stderr).toContain("warn");
		expect(result.timedOut).toBe(false);
	});

	test("enforces timeout and returns timedOut=true", async () => {
		const result = await runHookCommand("sleep 1", {
			cwd: process.cwd(),
			payload: basePayload,
			timeoutMs: 20,
		});

		expect(result.timedOut).toBe(true);
		expect(result.code).not.toBe(0);
	});

	test("truncates captured output safely", async () => {
		const result = await runHookCommand("yes x | head -n 1000", {
			cwd: process.cwd(),
			payload: basePayload,
			maxOutputBytes: 128,
		});

		expect(result.code).toBe(0);
		expect(result.stdoutTruncated).toBe(true);
		expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(128);
	});

	test("uses default timeout when not provided", async () => {
		const result = await runHookCommand("exit 0", {
			cwd: process.cwd(),
			payload: basePayload,
		});

		expect(result.code).toBe(0);
		expect(DEFAULT_HOOK_TIMEOUT_MS).toBe(5000);
	});
});
