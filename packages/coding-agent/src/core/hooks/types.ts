export const HOOK_EVENT_NAMES = ["SessionStart", "PreToolUse", "PostToolUse", "PreCompact"] as const;

export type HookEventName = (typeof HOOK_EVENT_NAMES)[number];

export type HooksConfigMap = Partial<Record<HookEventName, HookDefinition[]>>;

export interface HookDefinition {
	command: string;
	timeoutMs?: number;
	matcher?: HookMatcher;
	failOpen?: boolean;
}

export interface HookMatcher {
	toolNames?: string[];
}

export interface HookResolutionInput {
	hooksConfigPath?: string;
	hooksJson?: string;
	gastownMode?: boolean;
	enableClaudeSettingsLoader?: boolean;
}

export interface HookConfigSource {
	name: string;
	resolve(input: HookResolutionInput): Promise<HooksConfigMap | undefined>;
}

export interface HookConfigResolution {
	config: HooksConfigMap | undefined;
	sourceName: string | undefined;
	errors: string[];
}
