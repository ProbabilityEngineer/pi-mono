import {
	HOOK_EVENT_NAMES,
	type HookDefinition,
	type HookEventName,
	type HookMatcher,
	type HooksConfigMap,
} from "./types.js";

const EVENT_NAME_SET = new Set<string>(HOOK_EVENT_NAMES);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseHookMatcher(value: unknown, path: string): HookMatcher {
	if (!isRecord(value)) {
		throw new Error(`${path} must be an object`);
	}

	const toolNamesValue = value.toolNames;
	if (toolNamesValue === undefined) {
		return {};
	}
	if (!Array.isArray(toolNamesValue) || toolNamesValue.some((name) => typeof name !== "string")) {
		throw new Error(`${path}.toolNames must be an array of strings`);
	}

	return { toolNames: toolNamesValue };
}

function parseHookDefinition(value: unknown, path: string): HookDefinition {
	if (!isRecord(value)) {
		throw new Error(`${path} must be an object`);
	}

	const command = value.command;
	if (typeof command !== "string" || command.trim().length === 0) {
		throw new Error(`${path}.command must be a non-empty string`);
	}

	const timeoutMs = value.timeoutMs;
	if (timeoutMs !== undefined && (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
		throw new Error(`${path}.timeoutMs must be a positive number`);
	}

	const failOpen = value.failOpen;
	if (failOpen !== undefined && typeof failOpen !== "boolean") {
		throw new Error(`${path}.failOpen must be a boolean`);
	}

	const matcher = value.matcher;
	if (matcher !== undefined) {
		return {
			command,
			timeoutMs,
			failOpen,
			matcher: parseHookMatcher(matcher, `${path}.matcher`),
		};
	}

	return { command, timeoutMs, failOpen };
}

/**
 * Parse and validate hook config from a plain object.
 */
export function parseHooksConfig(value: unknown): HooksConfigMap {
	if (!isRecord(value)) {
		throw new Error("hooks config must be an object");
	}

	const config: HooksConfigMap = {};
	for (const [rawEventName, rawHooks] of Object.entries(value)) {
		if (!EVENT_NAME_SET.has(rawEventName)) {
			throw new Error(`unsupported hook event: ${rawEventName}`);
		}
		const eventName = rawEventName as HookEventName;
		if (!Array.isArray(rawHooks)) {
			throw new Error(`hooks.${eventName} must be an array`);
		}
		config[eventName] = rawHooks.map((rawHook, index) =>
			parseHookDefinition(rawHook, `hooks.${eventName}[${index}]`),
		);
	}

	return config;
}
