import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPT_TEMPLATE_PATH = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../prompts/ast-grep-agent-guided-install.md",
);

const FALLBACK_TEMPLATE = [
	"Attempt to install and verify ast-grep on this machine (expected command: {{command}}).",
	"Use these maintainer-provided manual setup instructions as the baseline: {{remediation}}",
	"Detect the current OS/toolchain and adapt commands accordingly.",
	"After setup, verify availability by running: {{command}} --version (or closest equivalent).",
	"If installation cannot be completed automatically, provide exact next commands and PATH/toolchain steps for me to run.",
].join("\n");

function loadTemplate(): string {
	if (!existsSync(PROMPT_TEMPLATE_PATH)) {
		return FALLBACK_TEMPLATE;
	}
	return readFileSync(PROMPT_TEMPLATE_PATH, "utf-8").trim();
}

export function buildAgentGuidedAstGrepInstallPrompt(command: string, remediation: string): string {
	return loadTemplate().replaceAll("{{command}}", command).replaceAll("{{remediation}}", remediation);
}
