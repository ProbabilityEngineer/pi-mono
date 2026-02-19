import type { HookConfigResolution } from "./types.js";

export function buildInvalidHookConfigWarning(resolution: HookConfigResolution): string {
	const source = resolution.invalidRuntimeSourceName ?? "runtime";
	const reason = resolution.invalidRuntimeReason ?? "invalid hook config";
	return `Warning: invalid hook config from ${source} (${reason}). Hooks are disabled for this session.`;
}
