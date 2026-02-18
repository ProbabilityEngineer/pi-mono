import { spawn } from "node:child_process";
import type { HookCommandRunOptions, HookCommandRunResult } from "./types.js";

export const DEFAULT_HOOK_TIMEOUT_MS = 5000;
export const DEFAULT_HOOK_MAX_OUTPUT_BYTES = 16 * 1024;

interface OutputCaptureState {
	value: string;
	bytes: number;
	truncated: boolean;
}

function appendCapturedOutput(state: OutputCaptureState, chunk: string, maxBytes: number): void {
	if (state.bytes >= maxBytes) {
		state.truncated = true;
		return;
	}

	const chunkBytes = Buffer.byteLength(chunk, "utf8");
	const remaining = maxBytes - state.bytes;
	if (chunkBytes <= remaining) {
		state.value += chunk;
		state.bytes += chunkBytes;
		return;
	}

	const prefix = Buffer.from(chunk, "utf8").subarray(0, remaining).toString("utf8");
	state.value += prefix;
	state.bytes += Buffer.byteLength(prefix, "utf8");
	state.truncated = true;
}

export async function runHookCommand(command: string, options: HookCommandRunOptions): Promise<HookCommandRunResult> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS;
	const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_HOOK_MAX_OUTPUT_BYTES;

	return new Promise((resolve) => {
		const stdoutState: OutputCaptureState = {
			value: "",
			bytes: 0,
			truncated: false,
		};
		const stderrState: OutputCaptureState = {
			value: "",
			bytes: 0,
			truncated: false,
		};

		let settled = false;
		let timedOut = false;
		let timeoutHandle: NodeJS.Timeout | undefined;

		const proc = spawn("/bin/sh", ["-lc", command], {
			cwd: options.cwd,
			stdio: ["pipe", "pipe", "pipe"],
		});

		const finish = (code: number) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			if (options.signal) {
				options.signal.removeEventListener("abort", onAbort);
			}
			resolve({
				code,
				stdout: stdoutState.value,
				stderr: stderrState.value,
				stdoutTruncated: stdoutState.truncated,
				stderrTruncated: stderrState.truncated,
				timedOut,
			});
		};

		const killProcess = () => {
			try {
				proc.kill("SIGTERM");
			} catch {
				// Ignore kill errors; close/error handlers will resolve.
			}
		};

		const onAbort = () => {
			killProcess();
		};

		proc.stdout?.on("data", (chunk: Buffer | string) => {
			appendCapturedOutput(stdoutState, chunk.toString(), maxOutputBytes);
		});

		proc.stderr?.on("data", (chunk: Buffer | string) => {
			appendCapturedOutput(stderrState, chunk.toString(), maxOutputBytes);
		});

		proc.on("error", (error) => {
			appendCapturedOutput(stderrState, error.message, maxOutputBytes);
			finish(1);
		});

		proc.on("close", (code) => {
			finish(code ?? 1);
		});

		if (options.signal) {
			if (options.signal.aborted) {
				onAbort();
			} else {
				options.signal.addEventListener("abort", onAbort, { once: true });
			}
		}

		timeoutHandle = setTimeout(() => {
			timedOut = true;
			killProcess();
		}, timeoutMs);

		const payload = `${JSON.stringify(options.payload)}\n`;
		try {
			proc.stdin?.write(payload);
			proc.stdin?.end();
		} catch (error) {
			appendCapturedOutput(stderrState, error instanceof Error ? error.message : String(error), maxOutputBytes);
			finish(1);
		}
	});
}
