import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import DEFAULTS from "./defaults.json";
import type { LspConfigFile, LspServerDefinition, ResolvedLspServer } from "./types.js";

const LOCAL_BIN_PATHS: Array<{ markers: string[]; binDir: string }> = [
	{ markers: ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"], binDir: "node_modules/.bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: ".venv/bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: "venv/bin" },
	{ markers: ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"], binDir: ".env/bin" },
];

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

export function resolveCommand(command: string, cwd: string): string | null {
	for (const { markers, binDir } of LOCAL_BIN_PATHS) {
		if (!hasRootMarkers(cwd, markers)) {
			continue;
		}
		const localPath = join(cwd, binDir, command);
		if (existsSync(localPath)) {
			return localPath;
		}
	}

	return resolveOnPath(command);
}

function resolveOnPath(command: string): string | null {
	const envPath = process.env.PATH;
	if (!envPath) {
		return null;
	}
	const delimiter = process.platform === "win32" ? ";" : ":";
	for (const dir of envPath.split(delimiter)) {
		if (!dir) {
			continue;
		}
		const executable = join(dir, command);
		if (existsSync(executable)) {
			return executable;
		}
		if (process.platform === "win32") {
			for (const ext of [".exe", ".cmd", ".bat"]) {
				const candidate = executable + ext;
				if (existsSync(candidate)) {
					return candidate;
				}
			}
		}
	}
	return null;
}

export function isCommandAvailable(command: string, cwd: string): boolean {
	return resolveCommand(command, cwd) !== null || resolveOnPath(command) !== null;
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
		const languages = override?.languages ?? server.languages;
		const installer = override?.installer ?? server.installer;
		merged[name] = { name, command, languages, installer };
	}

	for (const [name, override] of Object.entries(overrides)) {
		if (merged[name] || !override.command || !override.languages || override.disabled) {
			continue;
		}
		merged[name] = {
			name,
			command: override.command,
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
		.sort((a, b) => a.name.localeCompare(b.name));
}
