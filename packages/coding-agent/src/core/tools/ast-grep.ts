import { spawn } from "node:child_process";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { isCommandAvailable } from "../../lsp/config.js";
import { resolveToCwd } from "./path-utils.js";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateHead } from "./truncate.js";

const astGrepSchema = Type.Object({
	action: Type.Union([Type.Literal("search"), Type.Literal("version")], {
		description: "ast-grep action to run",
	}),
	pattern: Type.Optional(Type.String({ description: "ast-grep search pattern (required for search action)" })),
	path: Type.Optional(Type.String({ description: "Directory or file path to search (default: current directory)" })),
	language: Type.Optional(Type.String({ description: "Language hint passed to ast-grep, e.g. swift, ts, py" })),
	timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (optional, no default timeout)" })),
});

export type AstGrepToolInput = Static<typeof astGrepSchema>;

export interface AstGrepToolDetails {
	command?: "sg" | "ast-grep";
	truncated?: boolean;
}

interface AstGrepExecutionResult {
	exitCode: number | null;
	stdout: string;
	stderr: string;
}

export interface AstGrepOperations {
	commandAvailable: (command: string, cwd: string) => boolean;
	exec: (
		command: string,
		args: string[],
		cwd: string,
		timeout?: number,
		signal?: AbortSignal,
	) => Promise<AstGrepExecutionResult>;
}

const defaultAstGrepOperations: AstGrepOperations = {
	commandAvailable: isCommandAvailable,
	exec: (command, args, cwd, timeout, signal) =>
		new Promise<AstGrepExecutionResult>((resolve, reject) => {
			const child = spawn(command, args, {
				cwd,
				stdio: ["ignore", "pipe", "pipe"],
				env: process.env,
			});

			let stdout = "";
			let stderr = "";
			let timedOut = false;

			let timeoutHandle: NodeJS.Timeout | undefined;
			if (timeout !== undefined && timeout > 0) {
				timeoutHandle = setTimeout(() => {
					timedOut = true;
					child.kill("SIGTERM");
				}, timeout * 1000);
			}

			const onAbort = () => child.kill("SIGTERM");
			if (signal) {
				if (signal.aborted) {
					onAbort();
				} else {
					signal.addEventListener("abort", onAbort, { once: true });
				}
			}

			child.stdout.on("data", (chunk) => {
				stdout += chunk.toString();
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk.toString();
			});
			child.on("error", (error) => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (signal) signal.removeEventListener("abort", onAbort);
				reject(error);
			});
			child.on("close", (exitCode) => {
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (signal) signal.removeEventListener("abort", onAbort);
				if (timedOut) {
					reject(new Error(`ast-grep command timed out after ${timeout} seconds`));
					return;
				}
				resolve({ exitCode, stdout, stderr });
			});
		}),
};

function resolveAstGrepCommand(
	cwd: string,
	commandAvailable: AstGrepOperations["commandAvailable"],
): "sg" | "ast-grep" | undefined {
	if (commandAvailable("sg", cwd)) {
		return "sg";
	}
	if (commandAvailable("ast-grep", cwd)) {
		return "ast-grep";
	}
	return undefined;
}

export interface AstGrepToolOptions {
	operations?: Partial<AstGrepOperations>;
}

export function createAstGrepTool(cwd: string, options?: AstGrepToolOptions): AgentTool<typeof astGrepSchema> {
	const ops: AstGrepOperations = {
		...defaultAstGrepOperations,
		...(options?.operations ?? {}),
	};

	return {
		name: "ast-grep",
		label: "ast-grep",
		description: `Run syntax-aware structural search with ast-grep. Uses \`sg\` when available and falls back to \`ast-grep\`. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB.`,
		parameters: astGrepSchema,
		execute: async (
			_toolCallId: string,
			{ action, pattern, path, language, timeout }: AstGrepToolInput,
			signal?: AbortSignal,
		) => {
			const command = resolveAstGrepCommand(cwd, ops.commandAvailable);
			if (!command) {
				return {
					content: [
						{
							type: "text",
							text: "ast-grep is unavailable. Install `sg` (or `ast-grep`) and ensure it is on PATH.",
						},
					],
					details: { command: "sg" } satisfies AstGrepToolDetails,
				};
			}

			if (action === "version") {
				const result = await ops.exec(command, ["--version"], cwd, timeout, signal);
				const output = `${result.stdout}${result.stderr}`.trim();
				if (result.exitCode !== 0 && output.length === 0) {
					throw new Error(`ast-grep version check failed with exit code ${result.exitCode}`);
				}
				return {
					content: [{ type: "text", text: output || `${command} --version completed.` }],
					details: { command } satisfies AstGrepToolDetails,
				};
			}

			if (!pattern || pattern.trim().length === 0) {
				return {
					content: [{ type: "text", text: "Error: pattern is required for ast-grep search." }],
					details: { command } satisfies AstGrepToolDetails,
				};
			}

			const targetPath = resolveToCwd(path || ".", cwd);
			const args = ["scan", "--pattern", pattern, targetPath];
			if (language) {
				args.push("--lang", language);
			}

			const result = await ops.exec(command, args, cwd, timeout, signal);
			if (result.exitCode !== 0 && result.exitCode !== 1) {
				const errorText = (result.stderr || result.stdout).trim();
				throw new Error(errorText || `ast-grep exited with code ${result.exitCode}`);
			}

			const rawOutput = `${result.stdout}${result.stderr}`.trim();
			if (rawOutput.length === 0) {
				return {
					content: [{ type: "text", text: "No matches found." }],
					details: { command } satisfies AstGrepToolDetails,
				};
			}

			const truncation = truncateHead(rawOutput);
			return {
				content: [{ type: "text", text: truncation.content }],
				details: { command, truncated: truncation.truncated } satisfies AstGrepToolDetails,
			};
		},
	};
}

export const astGrepTool = createAstGrepTool(process.cwd());
