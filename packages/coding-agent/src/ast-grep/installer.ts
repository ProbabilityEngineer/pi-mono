import { spawn } from "node:child_process";
import { isCommandAvailable } from "../lsp/config.js";
import { type InstallCommandRunner, runInstallCommand } from "../lsp/installer.js";
import type { EnsureAstGrepInstalledOptions, EnsureAstGrepInstalledResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

function detectCommand(cwd: string, commandAvailable: (command: string, cwd: string) => boolean): "sg" | "ast-grep" {
	if (commandAvailable("sg", cwd)) {
		return "sg";
	}
	return "ast-grep";
}

function getInstallCommands(platform: NodeJS.Platform): string[][] {
	if (platform === "darwin") {
		return [
			["brew", "install", "ast-grep"],
			["npm", "install", "-g", "@ast-grep/cli"],
			["cargo", "install", "ast-grep"],
		];
	}
	if (platform === "linux") {
		return [
			["npm", "install", "-g", "@ast-grep/cli"],
			["cargo", "install", "ast-grep"],
		];
	}
	if (platform === "win32") {
		return [
			["npm", "install", "-g", "@ast-grep/cli"],
			["cargo", "install", "ast-grep"],
		];
	}
	return [];
}

function getFailureRemediation(platform: NodeJS.Platform): string {
	if (platform === "darwin") {
		return "Install via Homebrew (`brew install ast-grep`) or npm (`npm install -g @ast-grep/cli`) and ensure `sg` is on PATH.";
	}
	if (platform === "linux") {
		return "Install via npm (`npm install -g @ast-grep/cli`) or cargo (`cargo install ast-grep`) and ensure `sg` is on PATH.";
	}
	if (platform === "win32") {
		return "Install via npm (`npm install -g @ast-grep/cli`) or cargo (`cargo install ast-grep`) and ensure `sg` is on PATH.";
	}
	return "Install ast-grep manually and ensure `sg` is on PATH.";
}

function resolvePlatform(platformOverride?: NodeJS.Platform): NodeJS.Platform {
	return platformOverride ?? process.platform;
}

function isAstGrepAvailable(cwd: string, commandAvailable: (command: string, cwd: string) => boolean): boolean {
	return commandAvailable("sg", cwd) || commandAvailable("ast-grep", cwd);
}

export function canAutoInstallAstGrep(platformOverride?: NodeJS.Platform): boolean {
	const platform = resolvePlatform(platformOverride);
	return platform === "darwin" || platform === "linux" || platform === "win32";
}

export async function ensureAstGrepInstalled(
	cwd: string,
	options: EnsureAstGrepInstalledOptions = {},
): Promise<EnsureAstGrepInstalledResult> {
	const commandAvailable = options.commandAvailable ?? isCommandAvailable;
	const commandRunner: InstallCommandRunner = options.commandRunner ?? runInstallCommand;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const platform = resolvePlatform(options.platform);

	const detectedCommand = detectCommand(cwd, commandAvailable);
	if (isAstGrepAvailable(cwd, commandAvailable)) {
		return {
			command: detectedCommand,
			status: "already_installed",
			installed: false,
		};
	}

	const installCommands = getInstallCommands(platform);
	if (installCommands.length === 0) {
		return {
			command: "sg",
			status: "unsupported",
			installed: false,
			remediation: getFailureRemediation(platform),
		};
	}

	let lastError = "";
	for (const [command, ...args] of installCommands) {
		try {
			const result = await commandRunner(command, args, cwd, timeoutMs);
			if (result.exitCode !== 0) {
				lastError = result.stderr || result.stdout || `Installer command exited with ${result.exitCode}`;
				continue;
			}
			if (isAstGrepAvailable(cwd, commandAvailable)) {
				return {
					command: detectCommand(cwd, commandAvailable),
					status: "installed",
					installed: true,
				};
			}
			lastError = "Installer command completed but ast-grep is still unavailable on PATH.";
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	}

	return {
		command: "sg",
		status: "failed",
		installed: false,
		error: lastError || "Installation failed.",
		remediation: getFailureRemediation(platform),
	};
}

export async function runAstGrepInstallCommand(
	command: string,
	args: string[],
	cwd: string,
	timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: process.env,
		});

		let stdout = "";
		let stderr = "";
		const timeout = setTimeout(() => {
			child.kill("SIGTERM");
			reject(new Error(`Installer command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`));
		}, timeoutMs);

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timeout);
			resolve({ exitCode: code ?? 1, stdout, stderr });
		});
	});
}
