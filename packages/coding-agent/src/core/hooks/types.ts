export const HOOK_EVENT_NAMES = [
	"SessionStart",
	"PreToolUse",
	"PostToolUse",
	"PostToolUseFailure",
	"PreCompact",
] as const;

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
	cwd?: string;
	hooksConfigPath?: string;
	hooksJson?: string;
	gastownMode?: boolean;
	enableClaudeSettingsLoader?: boolean;
}

export interface HookConfigSource {
	name: string;
	resolve(input: HookResolutionInput): Promise<HooksConfigMap | undefined>;
}

export interface HookConfigDiagnostic {
	sourceName: string;
	message: string;
	isRuntimeSource: boolean;
}

export interface HookConfigResolution {
	config: HooksConfigMap | undefined;
	sourceName: string | undefined;
	errors: string[];
	diagnostics: HookConfigDiagnostic[];
	invalidRuntimeConfig: boolean;
	invalidRuntimeSourceName?: string;
	invalidRuntimeReason?: string;
	hooksDisabledForSession: boolean;
}

export interface HookCommandPayload {
	hook_event_name: HookEventName;
	cwd: string;
	tool_name?: string;
	tool_input?: Record<string, unknown>;
	tool_use_id?: string;
	tool_error?: string;
}

export interface HookCommandRunOptions {
	cwd: string;
	payload: HookCommandPayload;
	timeoutMs?: number;
	maxOutputBytes?: number;
	signal?: AbortSignal;
}

export interface HookCommandRunResult {
	code: number;
	stdout: string;
	stderr: string;
	stdoutTruncated: boolean;
	stderrTruncated: boolean;
	timedOut: boolean;
}

export interface HookInvocationRecord {
	eventName: HookEventName;
	command: string;
	configSourceName?: string;
	code: number;
	durationMs: number;
	stdout: string;
	stderr: string;
	timedOut: boolean;
	failed: boolean;
	decision?: "allow" | "deny" | "ask";
	reason?: string;
}

export interface HookSessionStartResult {
	additionalContext?: string;
	invocations: HookInvocationRecord[];
}

export interface HookPreToolUseResult {
	blocked: boolean;
	reason?: string;
	invocations: HookInvocationRecord[];
}

export interface HookPostToolUseResult {
	additionalContext?: string;
	invocations: HookInvocationRecord[];
}
