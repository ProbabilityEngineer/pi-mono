export { buildAgentGuidedAstGrepInstallPrompt } from "./agent-guided-install.js";
export {
	canAutoInstallAstGrep,
	ensureAstGrepInstalled,
	runAstGrepInstallCommand,
} from "./installer.js";
export { buildAstGrepSettingsState } from "./settings-state.js";
export type { AstGrepSettingsState, EnsureAstGrepInstalledOptions, EnsureAstGrepInstalledResult } from "./types.js";
