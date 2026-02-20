import { describe, expect, it } from "vitest";
import {
	getAstGrepActionOptions,
	getLspServerActionOptions,
} from "../src/modes/interactive/components/settings-selector.js";

describe("settings selector lsp server actions", () => {
	it("shows install/uninstall for installable servers", () => {
		const options = getLspServerActionOptions({
			name: "typescript-language-server",
			command: "typescript-language-server",
			enabled: true,
			installed: false,
			canInstall: true,
		});
		const values = options.map((option) => option.value);
		expect(values).toEqual(["toggle-enabled", "install", "uninstall", "back"]);
	});

	it("shows only agent-guided setup for unsupported installers", () => {
		const options = getLspServerActionOptions({
			name: "sourcekit-lsp",
			command: "sourcekit-lsp",
			enabled: true,
			installed: true,
			canInstall: false,
			manualRemediation: "Install command line tools",
		});
		const values = options.map((option) => option.value);
		expect(values).toEqual(["toggle-enabled", "attempt-agent-guided-manual-install", "back"]);
		expect(options[1]?.label).toBe("Attempt agent-guided setup");
		expect(options[1]?.description).toBe("Ask the agent to guide setup for this server");
	});
});

describe("settings selector ast-grep actions", () => {
	it("shows install and agent-guided setup when auto-install is supported", () => {
		const options = getAstGrepActionOptions({
			available: false,
			command: "sg",
			canInstall: true,
			manualRemediation: "Install ast-grep manually",
		});
		const values = options.map((option) => option.value);
		expect(values).toEqual(["install", "attempt-agent-guided-install", "back"]);
	});

	it("shows only agent-guided setup when auto-install is unavailable", () => {
		const options = getAstGrepActionOptions({
			available: false,
			command: "ast-grep",
			canInstall: false,
			manualRemediation: "Install ast-grep manually",
		});
		const values = options.map((option) => option.value);
		expect(values).toEqual(["attempt-agent-guided-install", "back"]);
	});
});
