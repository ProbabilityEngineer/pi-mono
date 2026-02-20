export function buildAgentGuidedManualInstallPrompt(serverName: string, command: string, remediation: string): string {
	return [
		`Attempt to install and verify the LSP server "${serverName}" (command: ${command}) on this machine.`,
		`Use these maintainer-provided manual setup instructions as the baseline: ${remediation}`,
		"Detect the current OS/toolchain and adapt commands accordingly.",
		`After setup, verify availability by running: ${command} --version (or closest equivalent).`,
		"If installation cannot be completed automatically, provide exact next commands and PATH/toolchain steps for me to run.",
	].join("\n");
}
