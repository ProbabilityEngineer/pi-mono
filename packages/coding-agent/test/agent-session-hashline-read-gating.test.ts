import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { beforeEach, describe, expect, it } from "vitest";
import { AgentSession } from "../src/core/agent-session.js";
import { AuthStorage } from "../src/core/auth-storage.js";
import { ModelRegistry } from "../src/core/model-registry.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";
import { codingTools, computeLineHash } from "../src/core/tools/index.js";
import { createTestResourceLoader } from "./utilities.js";

function extractText(result: unknown): string {
	const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
	return content
		.filter((block) => block.type === "text")
		.map((block) => block.text ?? "")
		.join("\n");
}

describe("AgentSession hashline read gating", () => {
	let tempDir: string;
	let testFile: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `agent-session-hashline-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		testFile = join(tempDir, "example.txt");
		writeFileSync(testFile, "alpha\nbeta\n", "utf-8");
	});

	it("suppresses hashline read output when edit tool is inactive", async () => {
		const model = getModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected anthropic claude-sonnet-4-5 model to exist in registry");

		const agent = new Agent({
			getApiKey: () => undefined,
			initialState: {
				model,
				systemPrompt: "test",
				tools: codingTools,
			},
		});
		const sessionManager = SessionManager.inMemory();
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		settingsManager.applyOverrides({ edit: { mode: "hashline" } });
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		const modelRegistry = new ModelRegistry(authStorage, tempDir);
		const session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRegistry,
			resourceLoader: createTestResourceLoader(),
			initialActiveToolNames: ["read", "grep", "bash", "write"],
		});

		try {
			const readTool = session.state.tools.find((tool) => tool.name === "read");
			if (!readTool) throw new Error("read tool is required for this test");
			const grepTool = session.state.tools.find((tool) => tool.name === "grep");
			if (!grepTool) throw new Error("grep tool is required for this test");

			const result = await readTool.execute("hashline-gating-off", { path: testFile });
			const output = extractText(result);
			const grepResult = await grepTool.execute("hashline-gating-off-grep", { pattern: "beta", path: testFile });
			const grepOutput = extractText(grepResult);

			expect(output).toContain("alpha");
			expect(output).toContain("beta");
			expect(output).not.toMatch(/^[0-9]+:[0-9a-f]{6}\|/m);
			expect(grepOutput).toContain("example.txt:2: beta");
			expect(grepOutput).not.toMatch(/example\.txt:2:[0-9a-f]{6}\|beta/);
		} finally {
			session.dispose();
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("keeps hashline read output when edit tool is active", async () => {
		const model = getModel("anthropic", "claude-sonnet-4-5");
		if (!model) throw new Error("Expected anthropic claude-sonnet-4-5 model to exist in registry");

		const agent = new Agent({
			getApiKey: () => undefined,
			initialState: {
				model,
				systemPrompt: "test",
				tools: codingTools,
			},
		});
		const sessionManager = SessionManager.inMemory();
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		settingsManager.applyOverrides({ edit: { mode: "hashline" } });
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		const modelRegistry = new ModelRegistry(authStorage, tempDir);
		const session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRegistry,
			resourceLoader: createTestResourceLoader(),
			initialActiveToolNames: ["read", "grep", "bash", "edit", "write"],
		});

		try {
			const readTool = session.state.tools.find((tool) => tool.name === "read");
			if (!readTool) throw new Error("read tool is required for this test");
			const grepTool = session.state.tools.find((tool) => tool.name === "grep");
			if (!grepTool) throw new Error("grep tool is required for this test");

			const result = await readTool.execute("hashline-gating-on", { path: testFile });
			const output = extractText(result);
			const grepResult = await grepTool.execute("hashline-gating-on-grep", { pattern: "beta", path: testFile });
			const grepOutput = extractText(grepResult);

			expect(output).toContain(`1:${computeLineHash(1, "alpha")}|alpha`);
			expect(output).toContain(`2:${computeLineHash(2, "beta")}|beta`);
			expect(grepOutput).toContain(`example.txt:2:${computeLineHash(2, "beta")}|beta`);
		} finally {
			session.dispose();
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
