import { describe, expect, it } from "vitest";
import { getLspServerActionOptions } from "../src/modes/interactive/components/settings-selector.js";

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

	it("shows manual setup and agent-guided actions for unsupported installers", () => {
		const options = getLspServerActionOptions({
			name: "sourcekit-lsp",
			command: "sourcekit-lsp",
			enabled: true,
			installed: true,
			canInstall: false,
			manualRemediation: "Install command line tools",
		});
		const values = options.map((option) => option.value);
		expect(values).toEqual([
			"toggle-enabled",
			"show-manual-setup-instructions",
			"attempt-agent-guided-manual-install",
			"back",
		]);
		expect(options[1]?.label).toBe("Show manual setup instructions");
		expect(options[2]?.label).toBe("Attempt agent-guided setup");
	});
});
