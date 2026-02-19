import type { HookConfigResolution } from "./types.js";

export function buildInvalidHookConfigWarning(resolution: HookConfigResolution): string {
	const source = resolution.invalidRuntimeSourceName ?? "runtime";
	const reason = resolution.invalidRuntimeReason ?? "invalid hook config";
	return `Warning: invalid hook config from ${source} (${reason}). Hooks are disabled for this session.`;
}

export function buildInvalidHookConfigWarningDetails(
	resolution: HookConfigResolution,
): Record<string, unknown> {
	return {
		type: "invalid_hook_config",
		source: resolution.invalidRuntimeSourceName ?? "runtime",
		reason: resolution.invalidRuntimeReason ?? "invalid hook config",
		hooksDisabledForSession: true,
		errors: [...resolution.errors],
		diagnostics: resolution.diagnostics.map((diagnostic) => ({
			sourceName: diagnostic.sourceName,
			message: diagnostic.message,
			isRuntimeSource: diagnostic.isRuntimeSource,
		})),
	};
}
