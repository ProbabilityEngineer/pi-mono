import { runHookCommand } from "./command-runner.js";
import { redactSensitiveText, truncateHookLogText } from "./logging-guardrails.js";
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
	configSourceName?: string;
}

function normalizeOutput(stdout: string, stderr: string): string | undefined {
	const output = [stdout.trim(), stderr.trim()].filter((part) => part.length > 0).join("\n");
	return output.length > 0 ? output : undefined;
}

export class HookRunner {
	private readonly config: HooksConfigMap;
	private readonly configSourceName: string | undefined;
	private sessionStartCompleted = false;

	constructor(options: HookRunnerOptions) {
		this.config = options.config;
		this.configSourceName = options.configSourceName;
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

			const startedAt = Date.now();
			const result = await runHookCommand(hook.command, {
				cwd,
				payload,
				timeoutMs: hook.timeoutMs,
			});
			const durationMs = Date.now() - startedAt;

			const failed = result.code !== 0 && result.code !== 2;
			const redactedStdout = redactSensitiveText(result.stdout);
			const redactedStderr = redactSensitiveText(result.stderr);
			const truncatedStdout = truncateHookLogText(redactedStdout.value);
			const truncatedStderr = truncateHookLogText(redactedStderr.value);
			const stdoutTruncated = result.stdoutTruncated || truncatedStdout.truncated;
			const stderrTruncated = result.stderrTruncated || truncatedStderr.truncated;
			invocations.push({
				eventName,
				command: hook.command,
				configSourceName: this.configSourceName,
				code: result.code,
				durationMs,
				stdout: truncatedStdout.value,
				stderr: truncatedStderr.value,
				timedOut: result.timedOut,
				failed,
				redacted: redactedStdout.redacted || redactedStderr.redacted,
				stdoutTruncated,
				stderrTruncated,
				truncated: stdoutTruncated || stderrTruncated,
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
		const hooks = this.config.PreToolUse ?? [];
		const invocations: HookInvocationRecord[] = [];
		for (const hook of hooks) {
			if (hook.matcher?.toolNames && !hook.matcher.toolNames.includes(toolName)) {
				continue;
			}

			const startedAt = Date.now();
			const result = await runHookCommand(hook.command, {
				cwd,
				payload: {
					hook_event_name: "PreToolUse",
					cwd,
					tool_name: toolName,
					tool_input: toolInput,
					tool_use_id: toolUseId,
				},
				timeoutMs: hook.timeoutMs,
			});
			const durationMs = Date.now() - startedAt;
			const failed = result.code !== 0 && result.code !== 2;
			const redactedStdout = redactSensitiveText(result.stdout);
			const redactedStderr = redactSensitiveText(result.stderr);
			const truncatedStdout = truncateHookLogText(redactedStdout.value);
			const truncatedStderr = truncateHookLogText(redactedStderr.value);
			const stdoutTruncated = result.stdoutTruncated || truncatedStdout.truncated;
			const stderrTruncated = result.stderrTruncated || truncatedStderr.truncated;
			const invocation: HookInvocationRecord = {
				eventName: "PreToolUse",
				command: hook.command,
				configSourceName: this.configSourceName,
				code: result.code,
				durationMs,
				stdout: truncatedStdout.value,
				stderr: truncatedStderr.value,
				timedOut: result.timedOut,
				failed,
				decision: "allow",
				redacted: redactedStdout.redacted || redactedStderr.redacted,
				stdoutTruncated,
				stderrTruncated,
				truncated: stdoutTruncated || stderrTruncated,
			};
			invocations.push(invocation);

			if (result.code === 2) {
				const reason = normalizeOutput(result.stdout, result.stderr) ?? "Tool call blocked by hook";
				const redactedReason = redactSensitiveText(reason);
				invocation.decision = "deny";
				invocation.reason = redactedReason.value;
				if (redactedReason.redacted) {
					invocation.redacted = true;
				}
				return {
					blocked: true,
					reason: redactedReason.value,
					invocations,
				};
			}

			if (failed && hook.failOpen === false) {
				const reason = normalizeOutput(result.stdout, result.stderr) ?? "Tool call blocked by hook failure";
				const redactedReason = redactSensitiveText(reason);
				invocation.decision = "deny";
				invocation.reason = redactedReason.value;
				if (redactedReason.redacted) {
					invocation.redacted = true;
				}
				return {
					blocked: true,
					reason: redactedReason.value,
					invocations,
				};
			}
		}

		return { blocked: false, invocations };
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

	async runPostToolUseFailure(
		cwd: string,
		toolName: string,
		toolInput: Record<string, unknown>,
		toolUseId: string,
		toolError?: string,
	): Promise<HookPostToolUseResult> {
		const invocations = await this.runEventHooks("PostToolUseFailure", cwd, {
			hook_event_name: "PostToolUseFailure",
			cwd,
			tool_name: toolName,
			tool_input: toolInput,
			tool_use_id: toolUseId,
			tool_error: toolError,
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
