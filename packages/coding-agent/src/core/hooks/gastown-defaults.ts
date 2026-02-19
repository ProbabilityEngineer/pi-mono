import { spawnSync } from "node:child_process";
import type { HooksConfigMap } from "./types.js";

function hasCommand(command: string): boolean {
	const result = spawnSync("/bin/sh", ["-lc", `command -v ${command}`], {
		stdio: "ignore",
	});
	return result.status === 0;
}

export interface GastownCommandAvailability {
	gt: boolean;
	bd: boolean;
}

export function buildGastownHookDefaults(availability: GastownCommandAvailability): HooksConfigMap | undefined {
	const config: HooksConfigMap = {};
	if (availability.gt) {
		config.SessionStart = [{ command: "gt prime" }];
		config.PreToolUse = [{ command: "gt tap guard" }];
	}
	if (availability.bd) {
		config.PreCompact = [{ command: "bd sync" }];
	}
	return Object.keys(config).length > 0 ? config : undefined;
}

export function resolveGastownHookDefaults(): HooksConfigMap | undefined {
	return buildGastownHookDefaults({
		gt: hasCommand("gt"),
		bd: hasCommand("bd"),
	});
}
