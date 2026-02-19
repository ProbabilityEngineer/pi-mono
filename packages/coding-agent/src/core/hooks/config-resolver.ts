import { readFile } from "node:fs/promises";
import { parseHooksConfig } from "./config.js";
import { resolveGastownHookDefaults } from "./gastown-defaults.js";
import type { HookConfigResolution, HookConfigSource, HookResolutionInput } from "./types.js";

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

	for (const source of sources) {
		try {
			const config = await source.resolve(input);
			if (config) {
				return {
					config,
					sourceName: source.name,
					errors,
				};
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errors.push(`[${source.name}] ${message}`);
			return {
				config: undefined,
				sourceName: source.name,
				errors,
			};
		}
	}

	return {
		config: undefined,
		sourceName: undefined,
		errors,
	};
}
