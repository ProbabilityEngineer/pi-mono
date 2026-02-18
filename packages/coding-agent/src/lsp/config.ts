import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import DEFAULTS from "./defaults.json";
import { type CommandProbeResult, type CommandProbeRunner, runCommandProbe } from "./probe.js";
import type { LspConfigFile, LspServerDefinition, ResolvedLspServer } from "./types.js";

const LOCAL_BIN_PATHS: Array<{ markers: string[]; binDir: string }> = [
	{ markers: ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"], binDir: "node_modules/.bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: ".venv/bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: "venv/bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: ".env/bin" },
];

const DEFAULT_WINDOWS_PATH_EXTENSIONS = [".com", ".exe", ".bat", ".cmd"];
const COMMAND_PROBE_TIMEOUT_MS = 1_500;
const SERVER_PRIORITY: Record<string, number> = {
	"typescript-language-server": 0,
	"vscode-json-language-server": 0,
	"vscode-css-language-server": 0,
	"vscode-html-language-server": 0,
	pyright: 0,
	"rust-analyzer": 0,
	gopls: 0,
	"sourcekit-lsp": 0,
};

export interface ResolveCommandOnPathOptions {
	platform?: NodeJS.Platform;
	envPath?: string;
	pathExt?: string;
	exists?: (path: string) => boolean;
}

export interface CommandAvailabilityOptions {
	platform?: NodeJS.Platform;
	envPath?: string;
	pathExt?: string;
	commandProbeContract?: CommandProbeContract;
	commandProbeRunner?: CommandProbeRunner;
	exists?: (path: string) => boolean;
}

function loadOverrides(cwd: string): Record<string, Partial<LspServerDefinition>> {
	const candidates = [join(cwd, "lsp.json"), join(cwd, ".pi", "lsp.json")];
	for (const path of candidates) {
		if (!existsSync(path)) {
			continue;
		}
		try {
			const parsed = JSON.parse(readFileSync(path, "utf-8")) as LspConfigFile;
			if (parsed.servers) {
				return parsed.servers;
			}
		} catch {
			// ignore invalid override files and continue with defaults
		}
	}
	return {};
}

function hasRootMarkers(cwd: string, markers: string[]): boolean {
	for (const marker of markers) {
		if (marker.includes("*")) {
			if (globSync(join(cwd, marker)).length > 0) {
				return true;
			}
		} else if (existsSync(join(cwd, marker))) {
			return true;
		}
	}
	return false;
}

export function resolveCommand(command: string, cwd: string, options: CommandAvailabilityOptions = {}): string | null {
	const platform = options.platform ?? process.platform;
	const pathExt = options.pathExt ?? process.env.PATHEXT;
	const exists = options.exists ?? existsSync;
	for (const { markers, binDir } of LOCAL_BIN_PATHS) {
		if (!hasRootMarkers(cwd, markers)) {
			continue;
		}
		const localPath = join(cwd, binDir, command);
		const resolvedLocalPath = resolveExecutablePath(localPath, {
			platform,
			pathExt,
			exists,
		});
		if (resolvedLocalPath) {
			return resolvedLocalPath;
		}
	}

	return resolveCommandOnPath(command, {
		platform,
		envPath: options.envPath ?? process.env.PATH,
		pathExt,
		exists,
	});
}

function normalizeWindowsPathExtensions(pathExt: string | undefined): string[] {
	const raw = pathExt ?? process.env.PATHEXT;
	if (!raw) {
		return DEFAULT_WINDOWS_PATH_EXTENSIONS;
	}
	const normalized = raw
		.split(";")
		.map((extension) => extension.trim().toLowerCase())
		.filter((extension) => extension.length > 0)
		.map((extension) => (extension.startsWith(".") ? extension : `.${extension}`));
	return normalized.length > 0 ? normalized : DEFAULT_WINDOWS_PATH_EXTENSIONS;
}

function resolveExecutablePath(
	commandPath: string,
	options: { platform: NodeJS.Platform; pathExt?: string; exists: (path: string) => boolean },
): string | null {
	if (options.exists(commandPath)) {
		return commandPath;
	}

	if (options.platform !== "win32") {
		return null;
	}

	for (const extension of normalizeWindowsPathExtensions(options.pathExt)) {
		const candidate = `${commandPath}${extension}`;
		if (options.exists(candidate)) {
			return candidate;
		}
	}

	return null;
}

export function resolveCommandOnPath(command: string, options: ResolveCommandOnPathOptions = {}): string | null {
	const platform = options.platform ?? process.platform;
	const envPath = options.envPath ?? process.env.PATH;
	const exists = options.exists ?? existsSync;
	if (!envPath) {
		return null;
	}

	const delimiter = platform === "win32" ? ";" : ":";
	for (const dir of envPath.split(delimiter)) {
		if (!dir) {
			continue;
		}
		const executable = join(dir, command);
		const resolvedPath = resolveExecutablePath(executable, {
			platform,
			pathExt: options.pathExt,
			exists,
		});
		if (resolvedPath) {
			return resolvedPath;
		}
	}
	return null;
}

export function probeCommandInvocation(
	commandPath: string,
	cwd: string,
	commandProbeRunner?: CommandProbeRunner,
): boolean {
	const result = probeCommandInvocationWithContract(
		commandPath,
		cwd,
		getDefaultCommandProbeContract(),
		commandProbeRunner,
	);
	if (result.timedOut) {
		return true;
	}
	return result.available;
}

export interface CommandProbeContract {
	timeoutMs: number;
	acceptableErrorCodes: string[];
	successExitCodes: number[];
}

export function getDefaultCommandProbeContract(): CommandProbeContract {
	return {
		timeoutMs: COMMAND_PROBE_TIMEOUT_MS,
		acceptableErrorCodes: ["ETIMEDOUT"],
		successExitCodes: [0],
	};
}

export function probeCommandInvocationWithContract(
	commandPath: string,
	cwd: string,
	contract: CommandProbeContract,
	commandProbeRunner?: CommandProbeRunner,
): CommandProbeResult {
	return runCommandProbe(
		{
			command: commandPath,
			args: ["--version"],
			cwd,
			timeoutMs: contract.timeoutMs,
			windowsHide: true,
			acceptableErrorCodes: contract.acceptableErrorCodes,
			successExitCodes: contract.successExitCodes,
		},
		commandProbeRunner,
	);
}

export function isCommandAvailable(command: string, cwd: string, options: CommandAvailabilityOptions = {}): boolean {
	const resolved = resolveCommand(command, cwd, options);
	if (!resolved) {
		return false;
	}

	const platform = options.platform ?? process.platform;
	if (platform !== "win32") {
		return true;
	}

	const probeResult = probeCommandInvocationWithContract(
		resolved,
		cwd,
		options.commandProbeContract ?? getDefaultCommandProbeContract(),
		options.commandProbeRunner,
	);
	if (probeResult.timedOut) {
		return true;
	}
	return probeResult.available;
}

export function loadLspServers(cwd: string): Record<string, ResolvedLspServer> {
	const defaults = DEFAULTS as Record<string, LspServerDefinition>;
	const overrides = loadOverrides(cwd);
	const merged: Record<string, ResolvedLspServer> = {};

	for (const [name, server] of Object.entries(defaults)) {
		const override = overrides[name];
		const disabled = override?.disabled ?? server.disabled;
		if (disabled) {
			continue;
		}
		const command = override?.command ?? server.command;
		const args = override?.args ?? server.args;
		const languages = override?.languages ?? server.languages;
		const installer = override?.installer ?? server.installer;
		merged[name] = { name, command, args, languages, installer };
	}

	for (const [name, override] of Object.entries(overrides)) {
		if (merged[name] || !override.command || !override.languages || override.disabled) {
			continue;
		}
		merged[name] = {
			name,
			command: override.command,
			args: override.args,
			languages: override.languages,
			installer: override.installer,
		};
	}

	return merged;
}

export function getServersForLanguage(languageId: string, cwd: string): ResolvedLspServer[] {
	const servers = loadLspServers(cwd);
	return Object.values(servers)
		.filter((server) => server.languages.includes(languageId))
		.sort((a, b) => {
			const leftPriority = SERVER_PRIORITY[a.name] ?? 100;
			const rightPriority = SERVER_PRIORITY[b.name] ?? 100;
			if (leftPriority !== rightPriority) {
				return leftPriority - rightPriority;
			}
			return a.name.localeCompare(b.name);
		});
}

export type { CommandProbeResult, CommandProbeRunner };
