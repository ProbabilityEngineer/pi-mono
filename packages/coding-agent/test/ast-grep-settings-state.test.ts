import { describe, expect, it } from "vitest";
import { buildAstGrepSettingsState } from "../src/ast-grep/settings-state.js";

describe("ast-grep settings state", () => {
	it("detects sg command as available", () => {
		const state = buildAstGrepSettingsState("/tmp", (command) => command === "sg", "darwin");
		expect(state.available).toBe(true);
		expect(state.command).toBe("sg");
		expect(state.canInstall).toBe(true);
	});

	it("falls back to ast-grep command name when sg is missing", () => {
		const state = buildAstGrepSettingsState("/tmp", (command) => command === "ast-grep", "linux");
		expect(state.available).toBe(true);
		expect(state.command).toBe("ast-grep");
	});

	it("marks auto-install unsupported on unknown platforms", () => {
		const state = buildAstGrepSettingsState("/tmp", () => false, "aix");
		expect(state.available).toBe(false);
		expect(state.canInstall).toBe(false);
	});
});
