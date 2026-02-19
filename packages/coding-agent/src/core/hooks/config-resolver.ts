import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseHooksConfig } from "./config.js";
import { resolveGastownHookDefaults } from "./gastown-defaults.js";
import type {
	HookConfigResolution,
	HookConfigSource,
	HookDefinition,
	HookResolutionInput,
	HooksConfigMap,
} from "./types.js";
import { HOOK_EVENT_NAMES } from "./types.js";

const HOOK_EVENT_NAME_SET = new Set<string>(HOOK_EVENT_NAMES);

const CLAUDE_SETTINGS_CANDIDATES = [".claude/settings.local.json", ".claude/settings.json"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseClaudeCommandHook(
	value: unknown,
	eventName: keyof HooksConfigMap,
	index: number,
	hookIndex: number,
): HookDefinition {
	if (!isRecord(value)) {
		throw new Error(`claude settings hooks.${eventName}[${index}].hooks[${hookIndex}] must be an object`);
	}
	const command = value.command;
	if (typeof command !== "string" || command.trim().length === 0) {
		throw new Error(`claude settings hooks.${eventName}[${index}].hooks[${hookIndex}].command must be a string`);
	}
	const timeoutValue = value.timeout;
	const timeoutMs =
		typeof timeoutValue === "number" && Number.isFinite(timeoutValue) && timeoutValue > 0
			? timeoutValue * 1000
			: undefined;
	return { command, timeoutMs };
}

function convertClaudeHooksShape(value: unknown): HooksConfigMap | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	const maybeHooks = value.hooks;
	if (!isRecord(maybeHooks)) {
		return undefined;
	}

	const config: HooksConfigMap = {};
	for (const [eventName, eventHooks] of Object.entries(maybeHooks)) {
		if (!HOOK_EVENT_NAME_SET.has(eventName)) {
			continue;
		}
		if (!Array.isArray(eventHooks)) {
			continue;
		}
		const definitions: HookDefinition[] = [];
		for (const [index, entry] of eventHooks.entries()) {
			if (!isRecord(entry) || !Array.isArray(entry.hooks)) {
				continue;
			}
			const toolMatcher =
				typeof entry.matcher === "string" && entry.matcher.length > 0 && entry.matcher !== "*"
					? [entry.matcher]
					: undefined;
			for (const [hookIndex, hook] of entry.hooks.entries()) {
				const parsed = parseClaudeCommandHook(hook, eventName as keyof HooksConfigMap, index, hookIndex);
				if (toolMatcher) {
					parsed.matcher = { toolNames: toolMatcher };
				}
				definitions.push(parsed);
			}
		}
		if (definitions.length > 0) {
			config[eventName as keyof HooksConfigMap] = definitions;
		}
	}
	return Object.keys(config).length > 0 ? config : undefined;
}

function parseClaudeSettingsHooks(value: unknown): HooksConfigMap | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	if ("hooks" in value) {
		const converted = convertClaudeHooksShape(value);
		if (converted) {
			return converted;
		}
		if (isRecord(value.hooks)) {
			return parseHooksConfig(value.hooks);
		}
		return undefined;
	}
	return undefined;
}

export const cliHooksConfigSource: HookConfigSource = {
	name: "cli",
	async resolve(input) {
		if (!input.hooksConfigPath) {
			return undefined;
		}
		const contents = await readFile(input.hooksConfigPath, "utf8");
		const parsed = JSON.parse(contents) as unknown;
		return parseHooksConfig(parsed);
	},
};

export const envHooksConfigSource: HookConfigSource = {
	name: "env",
	async resolve(input) {
		if (!input.hooksJson) {
			return undefined;
		}
		const parsed = JSON.parse(input.hooksJson) as unknown;
		return parseHooksConfig(parsed);
	},
};

export const claudeSettingsHookConfigSource: HookConfigSource = {
	name: "claude_settings",
	async resolve(input) {
		if (!input.enableClaudeSettingsLoader) {
			return undefined;
		}
		const baseDir = input.cwd ?? process.cwd();
		for (const relativePath of CLAUDE_SETTINGS_CANDIDATES) {
			const settingsPath = join(baseDir, relativePath);
			try {
				const contents = await readFile(settingsPath, "utf8");
				const parsed = JSON.parse(contents) as unknown;
				const hooks = parseClaudeSettingsHooks(parsed);
				if (hooks) {
					return hooks;
				}
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") {
					continue;
				}
				throw error;
			}
		}
		return undefined;
	},
};

export const gastownBuiltInHookConfigSource: HookConfigSource = {
	name: "gastown_builtin",
	async resolve(input) {
		if (!input.gastownMode) {
			return undefined;
		}
		return resolveGastownHookDefaults();
	},
};

const DEFAULT_HOOK_SOURCES: HookConfigSource[] = [
	cliHooksConfigSource,
	envHooksConfigSource,
	claudeSettingsHookConfigSource,
	gastownBuiltInHookConfigSource,
];

function isRuntimeConfigSource(sourceName: string): boolean {
	return sourceName === "cli" || sourceName === "env" || sourceName === "claude_settings";
}

export interface ResolveHooksConfigOptions {
	sources?: HookConfigSource[];
}

/**
 * Resolve hooks config using strict precedence.
 * The first source that yields config wins; source errors stop resolution.
 */
export async function resolveHooksConfig(
	input: HookResolutionInput,
	options: ResolveHooksConfigOptions = {},
): Promise<HookConfigResolution> {
	const sources = options.sources ?? DEFAULT_HOOK_SOURCES;
	const errors: string[] = [];
	const diagnostics: HookConfigResolution["diagnostics"] = [];

	for (const source of sources) {
		try {
			const config = await source.resolve(input);
			if (config) {
				return {
					config,
					sourceName: source.name,
					errors,
					diagnostics,
					invalidRuntimeConfig: false,
				};
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`[${source.name}] ${message}`);
			const isRuntimeSource = isRuntimeConfigSource(source.name);
			diagnostics.push({
				sourceName: source.name,
				message,
				isRuntimeSource,
			});
			return {
				config: undefined,
				sourceName: source.name,
				errors,
				diagnostics,
				invalidRuntimeConfig: isRuntimeSource,
				invalidRuntimeSourceName: isRuntimeSource ? source.name : undefined,
				invalidRuntimeReason: isRuntimeSource ? message : undefined,
			};
		}
	}

	return {
		config: undefined,
		sourceName: undefined,
		errors,
		diagnostics,
		invalidRuntimeConfig: false,
	};
}
