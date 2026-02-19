import type { Model } from "@mariozechner/pi-ai";
import type { TUI } from "@mariozechner/pi-tui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ModelSelectorComponent } from "../src/modes/interactive/components/model-selector.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

function makeModel(provider: string, id: string, name?: string): Model<any> {
	return {
		provider,
		id,
		name: name ?? id,
	} as Model<any>;
}

function makeTui(): TUI {
	return {
		requestRender: () => {},
	} as TUI;
}

async function flushPromises(): Promise<void> {
	await new Promise<void>((resolve) => {
		setImmediate(resolve);
	});
}

describe("ModelSelectorComponent", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("renders provider-grouped sections in /model", async () => {
		const models = [
			makeModel("openrouter", "qwen/qwen3-coder"),
			makeModel("anthropic", "claude-sonnet-4"),
			makeModel("openrouter", "minimax-m2.5-free"),
			makeModel("anthropic", "claude-opus-4.1"),
		];
		const registry = {
			refresh: vi.fn(),
			getError: vi.fn(() => undefined),
			getAvailable: vi.fn(async () => models),
		};
		const settingsManager = {
			setDefaultModelAndProvider: vi.fn(),
		};
		const selector = new ModelSelectorComponent(
			makeTui(),
			undefined,
			settingsManager as never,
			registry as never,
			[],
			() => {},
			() => {},
		);

		await flushPromises();

		const output = selector.render(120).join("\n");
		expect(output).toContain("anthropic (2)");
		expect(output).toContain("openrouter (2)");
		expect(output.indexOf("anthropic (2)")).toBeLessThan(output.indexOf("openrouter (2)"));
	});

	it("keeps provider groups contiguous after sorting", async () => {
		const models = [
			makeModel("openrouter", "z-model"),
			makeModel("anthropic", "b-model"),
			makeModel("openrouter", "a-model"),
			makeModel("anthropic", "a-model"),
		];
		const registry = {
			refresh: vi.fn(),
			getError: vi.fn(() => undefined),
			getAvailable: vi.fn(async () => models),
		};
		const settingsManager = {
			setDefaultModelAndProvider: vi.fn(),
		};
		const selector = new ModelSelectorComponent(
			makeTui(),
			undefined,
			settingsManager as never,
			registry as never,
			[],
			() => {},
			() => {},
		);

		await flushPromises();

		const providers = (selector as any).filteredModels.map((item: { provider: string }) => item.provider);
		expect(providers).toEqual(["anthropic", "anthropic", "openrouter", "openrouter"]);
	});

	it('filters /model list to ids containing "free" when setting is enabled', async () => {
		const models = [
			makeModel("openrouter", "qwen/qwen3-coder"),
			makeModel("openrouter", "minimax-m2.5-free"),
			makeModel("opencode", "deepseek-r1-free"),
		];
		const registry = {
			refresh: vi.fn(),
			getError: vi.fn(() => undefined),
			getAvailable: vi.fn(async () => models),
		};
		const settingsManager = {
			setDefaultModelAndProvider: vi.fn(),
		};
		const selector = new ModelSelectorComponent(
			makeTui(),
			undefined,
			settingsManager as never,
			registry as never,
			[],
			() => {},
			() => {},
			undefined,
			true,
		);

		await flushPromises();

		const output = selector.render(120).join("\n");
		expect(output).toContain("minimax-m2.5-free");
		expect(output).toContain("deepseek-r1-free");
		expect(output).not.toContain("qwen/qwen3-coder");
	});

	it("shows free-filter specific empty state when no models match", async () => {
		const models = [makeModel("openrouter", "qwen/qwen3-coder")];
		const registry = {
			refresh: vi.fn(),
			getError: vi.fn(() => undefined),
			getAvailable: vi.fn(async () => models),
		};
		const settingsManager = {
			setDefaultModelAndProvider: vi.fn(),
		};
		const selector = new ModelSelectorComponent(
			makeTui(),
			undefined,
			settingsManager as never,
			registry as never,
			[],
			() => {},
			() => {},
			undefined,
			true,
		);

		await flushPromises();

		const output = selector.render(120).join("\n");
		expect(output).toContain("No matching free models. Use /model for the full list.");
	});
});
