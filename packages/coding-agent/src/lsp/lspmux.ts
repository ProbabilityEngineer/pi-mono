import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { delimiter, join } from "node:path";
import type { LspmuxState, LspmuxWrappedCommand } from "./types.js";

const DEFAULT_SUPPORTED_SERVERS = new Set(["rust-analyzer"]);
const LIVENESS_TIMEOUT_MS = 1_000;
const STATE_CACHE_TTL_MS = 5 * 60_000;

let cachedState: LspmuxState | null = null;
let cacheTimestamp = 0;

function resolveCommandOnPath(command: string): string | null {
	const envPath = process.env.PATH;
	if (!envPath) {
		return null;
	}

	const segments = envPath.split(delimiter).filter(Boolean);
	for (const segment of segments) {
		const candidate = join(segment, command);
		if (platform() === "win32") {
			for (const extension of ["", ".exe", ".cmd", ".bat"]) {
				const executable = `${candidate}${extension}`;
				if (existsSync(executable)) {
					return executable;
				}
			}
		} else {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
	}

	return null;
}

async function checkServerRunning(binaryPath: string): Promise<boolean> {
	return await new Promise<boolean>((resolve) => {
		const proc = spawn(binaryPath, ["status"], {
			stdio: "ignore",
			windowsHide: true,
		});
		const timeout = setTimeout(() => {
			proc.kill();
			resolve(false);
		}, LIVENESS_TIMEOUT_MS);

		proc.once("error", () => {
			clearTimeout(timeout);
			resolve(false);
		});

		proc.once("close", (code) => {
			clearTimeout(timeout);
			resolve(code === 0);
		});
	});
}

export async function detectLspmux(): Promise<LspmuxState> {
	const now = Date.now();
	if (cachedState && now - cacheTimestamp < STATE_CACHE_TTL_MS) {
		return cachedState;
	}

	if (process.env.PI_DISABLE_LSPMUX === "1") {
		cachedState = { available: false, running: false, binaryPath: null };
		cacheTimestamp = now;
		return cachedState;
	}

	const binaryPath = resolveCommandOnPath("lspmux");
	if (!binaryPath) {
		cachedState = { available: false, running: false, binaryPath: null };
		cacheTimestamp = now;
		return cachedState;
	}

	const running = await checkServerRunning(binaryPath);
	cachedState = {
		available: true,
		running,
		binaryPath,
	};
	cacheTimestamp = now;
	return cachedState;
}

export function invalidateLspmuxCache(): void {
	cachedState = null;
	cacheTimestamp = 0;
}

export function isLspmuxSupported(command: string): boolean {
	const normalized = command.replace(/\\/g, "/");
	const baseName = normalized.split("/").pop() ?? normalized;
	return DEFAULT_SUPPORTED_SERVERS.has(baseName);
}

export function wrapWithLspmux(
	originalCommand: string,
	originalArgs: string[] | undefined,
	state: LspmuxState,
): LspmuxWrappedCommand {
	if (!state.available || !state.running || !state.binaryPath || !isLspmuxSupported(originalCommand)) {
		return { command: originalCommand, args: originalArgs ?? [] };
	}

	const hasArgs = Boolean(originalArgs && originalArgs.length > 0);
	if (!hasArgs && (originalCommand === "rust-analyzer" || originalCommand.endsWith("/rust-analyzer"))) {
		return { command: state.binaryPath, args: [] };
	}

	return {
		command: state.binaryPath,
		args: hasArgs ? ["client", "--", ...(originalArgs ?? [])] : ["client"],
		env: { LSPMUX_SERVER: originalCommand },
	};
}

export async function getLspmuxCommand(command: string, args?: string[]): Promise<LspmuxWrappedCommand> {
	const state = await detectLspmux();
	return wrapWithLspmux(command, args, state);
}

export async function isLspmuxActive(): Promise<boolean> {
	const state = await detectLspmux();
	return state.available && state.running;
}
