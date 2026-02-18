import { describe, expect, it } from "vitest";
import { probeCommandInvocationWithContract } from "../src/lsp/config.js";
import { type CommandProbeRunner, runCommandProbe } from "../src/lsp/probe.js";

describe("lsp command probe contract", () => {
	it("supports injectable runner and configurable success exit codes", () => {
		const runner: CommandProbeRunner = () =>
			({
				pid: 1,
				output: [null, null, null],
				stdout: Buffer.alloc(0),
				stderr: Buffer.alloc(0),
				status: 1,
				signal: null,
			}) as ReturnType<CommandProbeRunner>;

		const result = runCommandProbe(
			{
				command: "tool",
				args: ["--version"],
				cwd: process.cwd(),
				timeoutMs: 250,
				successExitCodes: [0, 1],
			},
			runner,
		);
		expect(result.available).toBe(true);
		expect(result.exitCode).toBe(1);
		expect(result.invoked).toBe(true);
	});

	it("marks ENOENT as unavailable and not invoked", () => {
		const runner: CommandProbeRunner = () =>
			({
				pid: 0,
				output: [null, null, null],
				stdout: Buffer.alloc(0),
				stderr: Buffer.alloc(0),
				status: null,
				signal: null,
				error: Object.assign(new Error("not found"), { code: "ENOENT" }),
			}) as ReturnType<CommandProbeRunner>;

		const result = runCommandProbe(
			{
				command: "missing-tool",
				args: ["--version"],
				cwd: process.cwd(),
				timeoutMs: 250,
			},
			runner,
		);
		expect(result.available).toBe(false);
		expect(result.invoked).toBe(false);
		expect(result.errorCode).toBe("ENOENT");
	});

	it("uses contract timeout/acceptable-errors in config wrapper", () => {
		const runner: CommandProbeRunner = () =>
			({
				pid: 10,
				output: [null, null, null],
				stdout: Buffer.alloc(0),
				stderr: Buffer.alloc(0),
				status: null,
				signal: "SIGTERM",
				error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
			}) as ReturnType<CommandProbeRunner>;

		const result = probeCommandInvocationWithContract(
			"tool",
			process.cwd(),
			{
				timeoutMs: 1_000,
				acceptableErrorCodes: ["ETIMEDOUT"],
				successExitCodes: [0],
			},
			runner,
		);
		expect(result.available).toBe(true);
		expect(result.timedOut).toBe(true);
		expect(result.invoked).toBe(true);
	});
});
