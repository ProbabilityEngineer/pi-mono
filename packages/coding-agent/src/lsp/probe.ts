import { type SpawnSyncOptions, type SpawnSyncReturns, spawnSync } from "node:child_process";

export interface CommandProbeSpec {
	command: string;
	args: string[];
	cwd: string;
	timeoutMs: number;
	windowsHide?: boolean;
	environment?: NodeJS.ProcessEnv;
	successExitCodes?: number[];
	acceptableErrorCodes?: string[];
}

export interface CommandProbeResult {
	available: boolean;
	invoked: boolean;
	exitCode: number | null;
	errorCode?: string;
	timedOut: boolean;
}

export type CommandProbeRunner = (
	command: string,
	args: string[],
	options: SpawnSyncOptions,
) => SpawnSyncReturns<Buffer>;

const DEFAULT_ACCEPTABLE_ERROR_CODES = ["ETIMEDOUT"];

export function runCommandProbe(
	spec: CommandProbeSpec,
	commandProbeRunner: CommandProbeRunner = spawnSync,
): CommandProbeResult {
	const result = commandProbeRunner(spec.command, spec.args, {
		cwd: spec.cwd,
		env: spec.environment ?? process.env,
		windowsHide: spec.windowsHide ?? true,
		stdio: "ignore",
		timeout: spec.timeoutMs,
	});

	const error = result.error as NodeJS.ErrnoException | undefined;
	const successExitCodes = spec.successExitCodes ?? [0];
	const acceptableErrorCodes = spec.acceptableErrorCodes ?? DEFAULT_ACCEPTABLE_ERROR_CODES;
	const timedOut = error?.code === "ETIMEDOUT";

	if (error) {
		if (error.code === "ENOENT" || error.code === "EACCES") {
			return {
				available: false,
				invoked: false,
				exitCode: result.status ?? null,
				errorCode: error.code,
				timedOut,
			};
		}

		return {
			available: acceptableErrorCodes.includes(error.code ?? ""),
			invoked: true,
			exitCode: result.status ?? null,
			errorCode: error.code,
			timedOut,
		};
	}

	return {
		available: successExitCodes.includes(result.status ?? 0),
		invoked: true,
		exitCode: result.status ?? null,
		timedOut,
	};
}
