import { describe, expect, it } from "vitest";
import { buildAgentGuidedAstGrepInstallPrompt } from "../src/ast-grep/agent-guided-install.js";

describe("ast-grep agent-guided install prompt", () => {
	it("renders placeholders from external template", () => {
		const prompt = buildAgentGuidedAstGrepInstallPrompt("sg", "Install via brew or npm and make sure sg is on PATH.");
		expect(prompt).toContain("expected command: sg");
		expect(prompt).toContain("Install via brew or npm and make sure sg is on PATH.");
		expect(prompt).toContain("sg --version");
		expect(prompt).not.toContain("{{command}}");
		expect(prompt).not.toContain("{{remediation}}");
	});
});
