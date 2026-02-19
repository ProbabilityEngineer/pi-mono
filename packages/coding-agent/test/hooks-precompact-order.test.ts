import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@mariozechner/pi-agent-core";
import { type AssistantMessage, type AssistantMessageEvent, EventStream, getModel } from "@mariozechner/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.js";
import { AuthStorage } from "../src/core/auth-storage.js";
import {
	createExtensionRuntime,
	type Extension,
	type SessionBeforeCompactEvent,
} from "../src/core/extensions/index.js";
import type { HooksConfigMap } from "../src/core/hooks/index.js";
import { ModelRegistry } from "../src/core/model-registry.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";
import { codingTools } from "../src/core/tools/index.js";
import { createTestResourceLoader } from "./utilities.js";

class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") {
					return event.message;
				}
				if (event.type === "error") {
					return event.error;
				}
				throw new Error("unexpected event type");
			},
		);
	}
}

function createAssistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "mock",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

describe("PreCompact hook ordering", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-precompact-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("runs PreCompact hooks before session_before_compact extensions", async () => {
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		const markerPath = join(tempDir, ".precompact.marker");
		let markerSeenByExtension = false;

		const extension: Extension = {
			path: "test-extension",
			resolvedPath: "/test/test-extension.ts",
			handlers: new Map<string, ((event: any, ctx: any) => Promise<any>)[]>([
				[
					"session_before_compact",
					[
						async (event: SessionBeforeCompactEvent) => {
							markerSeenByExtension = existsSync(markerPath);
							return {
								compaction: {
									summary: "custom",
									firstKeptEntryId: event.preparation.firstKeptEntryId,
									tokensBefore: event.preparation.tokensBefore,
								},
							};
						},
					],
				],
			]),
			tools: new Map(),
			messageRenderers: new Map(),
			commands: new Map(),
			flags: new Map(),
			shortcuts: new Map(),
		};

		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: {
				model,
				systemPrompt: "You are a test assistant.",
				tools: codingTools,
			},
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("done") });
				});
				return stream;
			},
		});

		const sessionManager = SessionManager.create(tempDir);
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const modelRegistry = new ModelRegistry(authStorage, tempDir);
		const runtime = createExtensionRuntime();
		const resourceLoader = {
			...createTestResourceLoader(),
			getExtensions: () => ({ extensions: [extension], errors: [], runtime }),
		};

		const hooksConfig: HooksConfigMap = {
			PreCompact: [{ command: "printf precompact > .precompact.marker" }],
		};
		const session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRegistry,
			resourceLoader,
			hooksConfig,
		});

		await session.prompt("first");
		await session.agent.waitForIdle();
		await session.prompt("second");
		await session.agent.waitForIdle();
		await session.compact();

		expect(markerSeenByExtension).toBe(true);
		expect(existsSync(markerPath)).toBe(true);
		session.dispose();
	}, 30000);
});
