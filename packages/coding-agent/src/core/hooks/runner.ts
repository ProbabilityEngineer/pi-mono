import { runHookCommand } from "./command-runner.js";
import type {
	HookCommandPayload,
	HookDefinition,
	HookEventName,
	HookInvocationRecord,
	HookPostToolUseResult,
	HookPreToolUseResult,
	HookSessionStartResult,
	HooksConfigMap,
} from "./types.js";

interface HookRunnerOptions {
	config: HooksConfigMap;
}

function normalizeOutput(stdout: string, stderr: string): string | undefined {
	const output = [stdout.trim(), stderr.trim()].filter((part) => part.length > 0).join("\n");
	return output.length > 0 ? output : undefined;
}

export class HookRunner {
	private readonly config: HooksConfigMap;
	private sessionStartCompleted = false;

	constructor(options: HookRunnerOptions) {
		this.config = options.config;
	}

	resetSessionStart(): void {
		this.sessionStartCompleted = false;
	}

	private async runEventHooks(
		eventName: HookEventName,
		cwd: string,
		payload: HookCommandPayload,
		matcher?: (hook: HookDefinition) => boolean,
	): Promise<HookInvocationRecord[]> {
		const hooks = this.config[eventName] ?? [];
		const invocations: HookInvocationRecord[] = [];

		for (const hook of hooks) {
			if (matcher && !matcher(hook)) {
				continue;
			}

			const result = await runHookCommand(hook.command, {
				cwd,
				payload,
				timeoutMs: hook.timeoutMs,
			});

			const failed = result.code !== 0 && result.code !== 2;
			invocations.push({
				eventName,
				command: hook.command,
				code: result.code,
				stdout: result.stdout,
				stderr: result.stderr,
				timedOut: result.timedOut,
				failed,
			});
		}

		return invocations;
	}

	async runSessionStart(cwd: string): Promise<HookSessionStartResult> {
		if (this.sessionStartCompleted) {
			return { invocations: [] };
		}
		this.sessionStartCompleted = true;

		const invocations = await this.runEventHooks("SessionStart", cwd, {
			hook_event_name: "SessionStart",
			cwd,
		});
		const outputs = invocations
			.map((item) => normalizeOutput(item.stdout, item.stderr))
			.filter((value): value is string => value !== undefined);

		return {
			additionalContext: outputs.length > 0 ? outputs.join("\n\n") : undefined,
			invocations,
		};
	}

	async runPreCompact(cwd: string): Promise<HookInvocationRecord[]> {
		return this.runEventHooks("PreCompact", cwd, {
			hook_event_name: "PreCompact",
			cwd,
		});
	}

	async runPreToolUse(
		cwd: string,
		toolName: string,
		toolInput: Record<string, unknown>,
		toolUseId: string,
	): Promise<HookPreToolUseResult> {
		const invocations = await this.runEventHooks(
			"PreToolUse",
			cwd,
			{
				hook_event_name: "PreToolUse",
				cwd,
				tool_name: toolName,
				tool_input: toolInput,
				tool_use_id: toolUseId,
			},
			(hook) => !hook.matcher?.toolNames || hook.matcher.toolNames.includes(toolName),
		);

		const blockedBy = invocations.find((item) => item.code === 2);
		if (!blockedBy) {
			return { blocked: false, invocations };
		}

		return {
			blocked: true,
			reason: normalizeOutput(blockedBy.stdout, blockedBy.stderr) ?? "Tool call blocked by hook",
			invocations,
		};
	}

	async runPostToolUse(
		cwd: string,
		toolName: string,
		toolInput: Record<string, unknown>,
		toolUseId: string,
	): Promise<HookPostToolUseResult> {
		const invocations = await this.runEventHooks("PostToolUse", cwd, {
			hook_event_name: "PostToolUse",
			cwd,
			tool_name: toolName,
			tool_input: toolInput,
			tool_use_id: toolUseId,
		});
		const outputs = invocations
			.map((item) => normalizeOutput(item.stdout, item.stderr))
			.filter((value): value is string => value !== undefined);

		return {
			additionalContext: outputs.length > 0 ? outputs.join("\n\n") : undefined,
			invocations,
		};
	}
}
