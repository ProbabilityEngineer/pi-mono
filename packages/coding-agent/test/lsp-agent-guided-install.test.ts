import { describe, expect, it } from "vitest";
import { buildAgentGuidedManualInstallPrompt } from "../src/lsp/agent-guided-install.js";

describe("lsp agent-guided install prompt", () => {
	it("includes server identity, remediation baseline, and verification command", () => {
		const prompt = buildAgentGuidedManualInstallPrompt(
			"sourcekit-lsp",
			"sourcekit-lsp",
			"Install Xcode command line tools with xcode-select --install",
		);

		expect(prompt).toContain('LSP server "sourcekit-lsp"');
		expect(prompt).toContain("Install Xcode command line tools");
		expect(prompt).toContain("sourcekit-lsp --version");
		expect(prompt).toContain("Detect the current OS/toolchain");
	});
});
