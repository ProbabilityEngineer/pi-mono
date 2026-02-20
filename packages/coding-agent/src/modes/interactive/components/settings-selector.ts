import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Transport } from "@mariozechner/pi-ai";
import {
	Container,
	getCapabilities,
	type SelectItem,
	SelectList,
	type SettingItem,
	SettingsList,
	Spacer,
	Text,
} from "@mariozechner/pi-tui";
import { getSelectListTheme, getSettingsListTheme, theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

const THINKING_DESCRIPTIONS: Record<ThinkingLevel, string> = {
	off: "No reasoning",
	minimal: "Very brief reasoning (~1k tokens)",
	low: "Light reasoning (~2k tokens)",
	medium: "Moderate reasoning (~8k tokens)",
	high: "Deep reasoning (~16k tokens)",
	xhigh: "Maximum reasoning (~32k tokens)",
};

export interface LspServerSettingEntry {
	name: string;
	command: string;
	enabled?: boolean;
	installed: boolean;
	canInstall: boolean;
	manualRemediation?: string;
}

export interface SettingsConfig {
	autoCompact: boolean;
	hashlineMode: boolean;
	gastownMode: boolean;
	showImages: boolean;
	autoResizeImages: boolean;
	blockImages: boolean;
	lspEnabled: boolean;
	lspServers: LspServerSettingEntry[];
	enableSkillCommands: boolean;
	steeringMode: "all" | "one-at-a-time";
	followUpMode: "all" | "one-at-a-time";
	transport: Transport;
	thinkingLevel: ThinkingLevel;
	availableThinkingLevels: ThinkingLevel[];
	currentTheme: string;
	availableThemes: string[];
	hideThinkingBlock: boolean;
	collapseChangelog: boolean;
	doubleEscapeAction: "fork" | "tree" | "none";
	showHardwareCursor: boolean;
	editorPaddingX: number;
	autocompleteMaxVisible: number;
	quietStartup: boolean;
	clearOnShrink: boolean;
}

export interface SettingsCallbacks {
	onAutoCompactChange: (enabled: boolean) => void;
	onHashlineModeChange: (enabled: boolean) => void;
	onGastownModeChange: (enabled: boolean) => void;
	onShowImagesChange: (enabled: boolean) => void;
	onAutoResizeImagesChange: (enabled: boolean) => void;
	onBlockImagesChange: (blocked: boolean) => void;
	onLspEnabledChange: (enabled: boolean) => void;
	onLspServerEnabledChange: (serverName: string, enabled: boolean) => void;
	onLspServerInstall: (serverName: string) => Promise<boolean> | boolean;
	onLspServerUninstall: (serverName: string) => Promise<boolean> | boolean;
	onLspServerAttemptAgentGuidedInstall: (serverName: string) => Promise<void> | void;
	onEnableSkillCommandsChange: (enabled: boolean) => void;
	onSteeringModeChange: (mode: "all" | "one-at-a-time") => void;
	onFollowUpModeChange: (mode: "all" | "one-at-a-time") => void;
	onTransportChange: (transport: Transport) => void;
	onThinkingLevelChange: (level: ThinkingLevel) => void;
	onThemeChange: (theme: string) => void;
	onThemePreview?: (theme: string) => void;
	onHideThinkingBlockChange: (hidden: boolean) => void;
	onCollapseChangelogChange: (collapsed: boolean) => void;
	onDoubleEscapeActionChange: (action: "fork" | "tree" | "none") => void;
	onShowHardwareCursorChange: (enabled: boolean) => void;
	onEditorPaddingXChange: (padding: number) => void;
	onAutocompleteMaxVisibleChange: (maxVisible: number) => void;
	onQuietStartupChange: (enabled: boolean) => void;
	onClearOnShrinkChange: (enabled: boolean) => void;
	onCancel: () => void;
}

export function getLspServerActionOptions(server: LspServerSettingEntry): SelectItem[] {
	const options: SelectItem[] = [
		{
			value: "toggle-enabled",
			label: server.enabled === false ? "Enable" : "Disable",
			description: server.enabled === false ? "Allow this server at runtime" : "Prevent this server at runtime",
		},
	];
	if (server.canInstall) {
		options.push(
			{ value: "install", label: "Install", description: "Run installer command" },
			{ value: "uninstall", label: "Uninstall", description: "Run uninstall command and disable server" },
		);
	} else {
		options.push({
			value: "attempt-agent-guided-manual-install",
			label: "Attempt agent-guided setup",
			description: "Ask the agent to guide setup for this server",
		});
	}
	options.push({ value: "back", label: "Back", description: "Return to server list" });
	return options;
}

/**
 * A submenu component for selecting from a list of options.
 */
class SelectSubmenu extends Container {
	private selectList: SelectList;

	constructor(
		title: string,
		description: string,
		options: SelectItem[],
		currentValue: string,
		onSelect: (value: string) => void,
		onCancel: () => void,
		onSelectionChange?: (value: string) => void,
	) {
		super();

		// Title
		this.addChild(new Text(theme.bold(theme.fg("accent", title)), 0, 0));

		// Description
		if (description) {
			this.addChild(new Spacer(1));
			this.addChild(new Text(theme.fg("muted", description), 0, 0));
		}

		// Spacer
		this.addChild(new Spacer(1));

		// Select list
		this.selectList = new SelectList(options, Math.min(options.length, 10), getSelectListTheme());

		// Pre-select current value
		const currentIndex = options.findIndex((o) => o.value === currentValue);
		if (currentIndex !== -1) {
			this.selectList.setSelectedIndex(currentIndex);
		}

		this.selectList.onSelect = (item) => {
			onSelect(item.value);
		};

		this.selectList.onCancel = onCancel;

		if (onSelectionChange) {
			this.selectList.onSelectionChange = (item) => {
				onSelectionChange(item.value);
			};
		}

		this.addChild(this.selectList);

		// Hint
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "  Enter to select · Esc to go back"), 0, 0));
	}

	handleInput(data: string): void {
		this.selectList.handleInput(data);
	}
}

class LspServerSubmenu extends Container {
	private selectList: SelectList;
	private servers: LspServerSettingEntry[];

	constructor(
		servers: LspServerSettingEntry[],
		private callbacks: Pick<
			SettingsCallbacks,
			| "onLspServerEnabledChange"
			| "onLspServerInstall"
			| "onLspServerUninstall"
			| "onLspServerAttemptAgentGuidedInstall"
		>,
		private onDone: () => void,
	) {
		super();
		this.servers = [...servers].sort((a, b) => a.name.localeCompare(b.name));
		this.selectList = new SelectList([], 10, getSelectListTheme());
		this.renderServerList();
	}

	private renderServerList(): void {
		this.clear();
		this.addChild(new Text(theme.bold(theme.fg("accent", "LSP Servers")), 0, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("muted", "Select a server to manage"), 0, 0));
		this.addChild(new Spacer(1));

		const options: SelectItem[] = this.servers.map((server) => {
			const enabledText = server.enabled === false ? "disabled" : "enabled";
			const installText = server.installed ? "installed" : "not installed";
			return {
				value: server.name,
				label: server.name,
				description: `${enabledText} · ${installText} · ${server.command}`,
			};
		});

		this.selectList = new SelectList(options, Math.min(options.length, 12), getSelectListTheme());
		this.selectList.onSelect = (item) => {
			const selected = this.servers.find((server) => server.name === item.value);
			if (!selected) {
				return;
			}
			this.renderServerActions(selected);
		};
		this.selectList.onCancel = this.onDone;

		this.addChild(this.selectList);
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "  Enter to manage · Esc to go back"), 0, 0));
	}

	private renderServerActions(server: LspServerSettingEntry): void {
		this.clear();
		this.addChild(new Text(theme.bold(theme.fg("accent", `Server: ${server.name}`)), 0, 0));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("muted", `${server.command}`), 0, 0));
		this.addChild(new Spacer(1));

		const actionOptions = getLspServerActionOptions(server);

		this.selectList = new SelectList(actionOptions, actionOptions.length, getSelectListTheme());
		this.selectList.onSelect = (item) => {
			if (item.value === "back") {
				this.renderServerList();
				return;
			}
			void (async () => {
				if (item.value === "toggle-enabled") {
					const nextEnabled = server.enabled === false;
					server.enabled = nextEnabled;
					this.callbacks.onLspServerEnabledChange(server.name, nextEnabled);
				}
				if (item.value === "install") {
					const installSucceeded = await this.callbacks.onLspServerInstall(server.name);
					if (installSucceeded) {
						server.installed = true;
						server.enabled = true;
					}
				}
				if (item.value === "uninstall") {
					const uninstallSucceeded = await this.callbacks.onLspServerUninstall(server.name);
					if (uninstallSucceeded) {
						server.installed = false;
						server.enabled = false;
					}
				}
				if (item.value === "attempt-agent-guided-manual-install") {
					await this.callbacks.onLspServerAttemptAgentGuidedInstall(server.name);
				}
				this.renderServerActions(server);
			})();
		};
		this.selectList.onCancel = () => {
			this.renderServerList();
		};

		this.addChild(this.selectList);
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("dim", "  Enter to run action · Esc to go back"), 0, 0));
	}

	handleInput(data: string): void {
		this.selectList.handleInput(data);
	}
}

/**
 * Main settings selector component.
 */
export class SettingsSelectorComponent extends Container {
	private settingsList: SettingsList;

	constructor(config: SettingsConfig, callbacks: SettingsCallbacks) {
		super();

		const supportsImages = getCapabilities().images;

		const items: SettingItem[] = [
			{
				id: "autocompact",
				label: "Auto-compact",
				description: "Automatically compact context when it gets too large",
				currentValue: config.autoCompact ? "true" : "false",
				values: ["true", "false"],
			},
			{
				id: "hashline-mode",
				label: "Hashline mode",
				description: "Use hashline anchors for line edits",
				currentValue: config.hashlineMode ? "true" : "false",
				values: ["true", "false"],
			},
			{
				id: "gastown-mode",
				label: "Gastown mode",
				description: "Enable built-in Gastown-compatible hook defaults",
				currentValue: config.gastownMode ? "true" : "false",
				values: ["true", "false"],
			},
			{
				id: "steering-mode",
				label: "Steering mode",
				description:
					"Enter while streaming queues steering messages. 'one-at-a-time': deliver one, wait for response. 'all': deliver all at once.",
				currentValue: config.steeringMode,
				values: ["one-at-a-time", "all"],
			},
			{
				id: "follow-up-mode",
				label: "Follow-up mode",
				description:
					"Alt+Enter queues follow-up messages until agent stops. 'one-at-a-time': deliver one, wait for response. 'all': deliver all at once.",
				currentValue: config.followUpMode,
				values: ["one-at-a-time", "all"],
			},
			{
				id: "transport",
				label: "Transport",
				description: "Preferred transport for providers that support multiple transports",
				currentValue: config.transport,
				values: ["sse", "websocket", "auto"],
			},
			{
				id: "hide-thinking",
				label: "Hide thinking",
				description: "Hide thinking blocks in assistant responses",
				currentValue: config.hideThinkingBlock ? "true" : "false",
				values: ["true", "false"],
			},
			{
				id: "collapse-changelog",
				label: "Collapse changelog",
				description: "Show condensed changelog after updates",
				currentValue: config.collapseChangelog ? "true" : "false",
				values: ["true", "false"],
			},
			{
				id: "quiet-startup",
				label: "Quiet startup",
				description: "Disable verbose printing at startup",
				currentValue: config.quietStartup ? "true" : "false",
				values: ["true", "false"],
			},
			{
				id: "double-escape-action",
				label: "Double-escape action",
				description: "Action when pressing Escape twice with empty editor",
				currentValue: config.doubleEscapeAction,
				values: ["tree", "fork", "none"],
			},
			{
				id: "thinking",
				label: "Thinking level",
				description: "Reasoning depth for thinking-capable models",
				currentValue: config.thinkingLevel,
				submenu: (currentValue, done) =>
					new SelectSubmenu(
						"Thinking Level",
						"Select reasoning depth for thinking-capable models",
						config.availableThinkingLevels.map((level) => ({
							value: level,
							label: level,
							description: THINKING_DESCRIPTIONS[level],
						})),
						currentValue,
						(value) => {
							callbacks.onThinkingLevelChange(value as ThinkingLevel);
							done(value);
						},
						() => done(),
					),
			},
			{
				id: "theme",
				label: "Theme",
				description: "Color theme for the interface",
				currentValue: config.currentTheme,
				submenu: (currentValue, done) =>
					new SelectSubmenu(
						"Theme",
						"Select color theme",
						config.availableThemes.map((t) => ({
							value: t,
							label: t,
						})),
						currentValue,
						(value) => {
							callbacks.onThemeChange(value);
							done(value);
						},
						() => {
							// Restore original theme on cancel
							callbacks.onThemePreview?.(currentValue);
							done();
						},
						(value) => {
							// Preview theme on selection change
							callbacks.onThemePreview?.(value);
						},
					),
			},
		];

		// Only show image toggle if terminal supports it
		if (supportsImages) {
			// Insert after autocompact
			items.splice(1, 0, {
				id: "show-images",
				label: "Show images",
				description: "Render images inline in terminal",
				currentValue: config.showImages ? "true" : "false",
				values: ["true", "false"],
			});
		}

		// Image auto-resize toggle (always available, affects both attached and read images)
		items.splice(supportsImages ? 2 : 1, 0, {
			id: "auto-resize-images",
			label: "Auto-resize images",
			description: "Resize large images to 2000x2000 max for better model compatibility",
			currentValue: config.autoResizeImages ? "true" : "false",
			values: ["true", "false"],
		});

		// Block images toggle (always available, insert after auto-resize-images)
		const autoResizeIndex = items.findIndex((item) => item.id === "auto-resize-images");
		items.splice(autoResizeIndex + 1, 0, {
			id: "block-images",
			label: "Block images",
			description: "Prevent images from being sent to LLM providers",
			currentValue: config.blockImages ? "true" : "false",
			values: ["true", "false"],
		});

		// Skill commands toggle (insert after block-images)
		const blockImagesIndex = items.findIndex((item) => item.id === "block-images");
		items.splice(blockImagesIndex + 1, 0, {
			id: "skill-commands",
			label: "Skill commands",
			description: "Register skills as /skill:name commands",
			currentValue: config.enableSkillCommands ? "true" : "false",
			values: ["true", "false"],
		});

		// LSP toggle (insert after skill-commands)
		const skillCommandsIndex = items.findIndex((item) => item.id === "skill-commands");
		items.splice(skillCommandsIndex + 1, 0, {
			id: "lsp-enabled",
			label: "LSP",
			description: "Enable language intelligence tool",
			currentValue: config.lspEnabled ? "true" : "false",
			values: ["true", "false"],
		});

		// LSP server management submenu (insert after lsp-enabled)
		const lspEnabledIndex = items.findIndex((item) => item.id === "lsp-enabled");
		items.splice(lspEnabledIndex + 1, 0, {
			id: "lsp-servers",
			label: "LSP servers",
			description: "Manage individual servers (enable/disable/install/uninstall)",
			currentValue: `${config.lspServers.filter((server) => server.enabled !== false).length}/${config.lspServers.length} enabled`,
			submenu: (_currentValue, done) =>
				new LspServerSubmenu(
					config.lspServers,
					{
						onLspServerEnabledChange: callbacks.onLspServerEnabledChange,
						onLspServerInstall: callbacks.onLspServerInstall,
						onLspServerUninstall: callbacks.onLspServerUninstall,
						onLspServerAttemptAgentGuidedInstall: callbacks.onLspServerAttemptAgentGuidedInstall,
					},
					() => done(),
				),
		});

		// Hardware cursor toggle (insert after lsp-servers)
		const lspServersIndex = items.findIndex((item) => item.id === "lsp-servers");
		items.splice(lspServersIndex + 1, 0, {
			id: "show-hardware-cursor",
			label: "Show hardware cursor",
			description: "Show the terminal cursor while still positioning it for IME support",
			currentValue: config.showHardwareCursor ? "true" : "false",
			values: ["true", "false"],
		});

		// Editor padding toggle (insert after show-hardware-cursor)
		const hardwareCursorIndex = items.findIndex((item) => item.id === "show-hardware-cursor");
		items.splice(hardwareCursorIndex + 1, 0, {
			id: "editor-padding",
			label: "Editor padding",
			description: "Horizontal padding for input editor (0-3)",
			currentValue: String(config.editorPaddingX),
			values: ["0", "1", "2", "3"],
		});

		// Autocomplete max visible toggle (insert after editor-padding)
		const editorPaddingIndex = items.findIndex((item) => item.id === "editor-padding");
		items.splice(editorPaddingIndex + 1, 0, {
			id: "autocomplete-max-visible",
			label: "Autocomplete max items",
			description: "Max visible items in autocomplete dropdown (3-20)",
			currentValue: String(config.autocompleteMaxVisible),
			values: ["3", "5", "7", "10", "15", "20"],
		});

		// Clear on shrink toggle (insert after autocomplete-max-visible)
		const autocompleteIndex = items.findIndex((item) => item.id === "autocomplete-max-visible");
		items.splice(autocompleteIndex + 1, 0, {
			id: "clear-on-shrink",
			label: "Clear on shrink",
			description: "Clear empty rows when content shrinks (may cause flicker)",
			currentValue: config.clearOnShrink ? "true" : "false",
			values: ["true", "false"],
		});

		// Add borders
		this.addChild(new DynamicBorder());

		this.settingsList = new SettingsList(
			items,
			10,
			getSettingsListTheme(),
			(id, newValue) => {
				switch (id) {
					case "autocompact":
						callbacks.onAutoCompactChange(newValue === "true");
						break;
					case "hashline-mode":
						callbacks.onHashlineModeChange(newValue === "true");
						break;
					case "gastown-mode":
						callbacks.onGastownModeChange(newValue === "true");
						break;
					case "show-images":
						callbacks.onShowImagesChange(newValue === "true");
						break;
					case "auto-resize-images":
						callbacks.onAutoResizeImagesChange(newValue === "true");
						break;
					case "block-images":
						callbacks.onBlockImagesChange(newValue === "true");
						break;
					case "skill-commands":
						callbacks.onEnableSkillCommandsChange(newValue === "true");
						break;
					case "lsp-enabled":
						callbacks.onLspEnabledChange(newValue === "true");
						break;
					case "steering-mode":
						callbacks.onSteeringModeChange(newValue as "all" | "one-at-a-time");
						break;
					case "follow-up-mode":
						callbacks.onFollowUpModeChange(newValue as "all" | "one-at-a-time");
						break;
					case "transport":
						callbacks.onTransportChange(newValue as Transport);
						break;
					case "hide-thinking":
						callbacks.onHideThinkingBlockChange(newValue === "true");
						break;
					case "collapse-changelog":
						callbacks.onCollapseChangelogChange(newValue === "true");
						break;
					case "quiet-startup":
						callbacks.onQuietStartupChange(newValue === "true");
						break;
					case "double-escape-action":
						callbacks.onDoubleEscapeActionChange(newValue as "fork" | "tree");
						break;
					case "show-hardware-cursor":
						callbacks.onShowHardwareCursorChange(newValue === "true");
						break;
					case "editor-padding":
						callbacks.onEditorPaddingXChange(parseInt(newValue, 10));
						break;
					case "autocomplete-max-visible":
						callbacks.onAutocompleteMaxVisibleChange(parseInt(newValue, 10));
						break;
					case "clear-on-shrink":
						callbacks.onClearOnShrinkChange(newValue === "true");
						break;
				}
			},
			callbacks.onCancel,
			{ enableSearch: true },
		);

		this.addChild(this.settingsList);
		this.addChild(new DynamicBorder());
	}

	getSettingsList(): SettingsList {
		return this.settingsList;
	}
}
