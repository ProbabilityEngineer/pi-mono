import { spawn } from "node:child_process";
import { isCommandAvailable } from "./config.js";
import type { ResolvedLspServer } from "./types.js";

export interface InstallCommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export type InstallCommandRunner = (
	command: string,
	args: string[],
	cwd: string,
	timeoutMs: number,
) => Promise<InstallCommandResult>;

export interface EnsureServerInstalledOptions {
	commandRunner?: InstallCommandRunner;
	commandAvailable?: (command: string, cwd: string) => boolean;
	timeoutMs?: number;
}

export interface EnsureServerInstalledResult {
	server: string;
	command: string;
	status: "already_installed" | "installed" | "failed" | "unsupported";
	installed: boolean;
	remediation?: string;
	error?: string;
}

export async function ensureServerInstalled(
	cwd: string,
	server: ResolvedLspServer,
	options: EnsureServerInstalledOptions = {},
): Promise<EnsureServerInstalledResult> {
	const commandAvailable =
		options.commandAvailable ?? ((command: string, commandCwd: string) => isCommandAvailable(command, commandCwd));
	const timeoutMs = options.timeoutMs ?? 30_000;
	const commandRunner = options.commandRunner ?? runInstallCommand;

	if (commandAvailable(server.command, cwd)) {
		return {
			server: server.name,
			command: server.command,
			status: "already_installed",
			installed: false,
		};
	}

	const installer = server.installer;
	if (!installer || installer.kind === "unsupported") {
		return {
			server: server.name,
			command: server.command,
			status: "unsupported",
			installed: false,
			remediation:
				installer?.remediation ??
				`Install ${server.command} manually and ensure it is available on PATH or project-local bin paths.`,
		};
	}

	const installCommands = buildInstallCommands(installer.kind, installer.package ?? server.command);
	let lastError = "";
	for (const [command, ...args] of installCommands) {
		try {
			const result = await commandRunner(command, args, cwd, timeoutMs);
			if (result.exitCode !== 0) {
				lastError = result.stderr || result.stdout || `Installer command exited with ${result.exitCode}`;
				continue;
			}
			if (commandAvailable(server.command, cwd)) {
				return {
					server: server.name,
					command: server.command,
					status: "installed",
					installed: true,
				};
			}
			lastError = `Installer ran successfully but ${server.command} is still unavailable.`;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	}

	return {
		server: server.name,
		command: server.command,
		status: "failed",
		installed: false,
		error: lastError || "Installation failed.",
		remediation: getFailureRemediation(installer.kind, installer.package ?? server.command),
	};
}

function buildInstallCommands(kind: "npm" | "pip" | "pipx", packageName: string): string[][] {
	if (kind === "npm") {
		return [["npm", "install", "--no-save", "--save-dev", packageName]];
	}
	if (kind === "pipx") {
		return [["pipx", "install", packageName]];
	}
	return [
		["python3", "-m", "pip", "install", "--user", packageName],
		["pip3", "install", "--user", packageName],
	];
}

function getFailureRemediation(kind: "npm" | "pip" | "pipx", packageName: string): string {
	if (kind === "npm") {
		return `Run \`npm install --no-save --save-dev ${packageName}\` in the project root, then retry.`;
	}
	if (kind === "pipx") {
		return `Run \`pipx install ${packageName}\` and ensure pipx bin is on PATH, then retry.`;
	}
	return `Run \`python3 -m pip install --user ${packageName}\` and ensure your user bin directory is on PATH, then retry.`;
}

export async function runInstallCommand(
	command: string,
	args: string[],
	cwd: string,
	timeoutMs: number,
): Promise<InstallCommandResult> {
	return await new Promise<InstallCommandResult>((resolve, reject) => {
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
