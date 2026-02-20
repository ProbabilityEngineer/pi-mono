import { isCommandAvailable } from "../lsp/config.js";
import { canAutoInstallAstGrep } from "./installer.js";
import type { AstGrepSettingsState } from "./types.js";

export function buildAstGrepSettingsState(
	cwd: string,
	commandAvailable: (command: string, cwd: string) => boolean = isCommandAvailable,
	platform: NodeJS.Platform = process.platform,
): AstGrepSettingsState {
	const hasSg = commandAvailable("sg", cwd);
	const hasAstGrep = commandAvailable("ast-grep", cwd);
	const command: "sg" | "ast-grep" = hasSg ? "sg" : "ast-grep";
	const available = hasSg || hasAstGrep;

	return {
		available,
		command,
		canInstall: canAutoInstallAstGrep(platform),
		manualRemediation:
			"Install ast-grep and ensure `sg` is available on PATH. Example: `brew install ast-grep` or `npm install -g @ast-grep/cli`.",
	};
}
