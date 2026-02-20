import { describe, expect, it } from "vitest";
import { BUILTIN_SLASH_COMMANDS } from "../src/core/slash-commands.js";

describe("builtin slash commands", () => {
	it("includes help command", () => {
		expect(BUILTIN_SLASH_COMMANDS.some((command) => command.name === "help")).toBe(true);
	});
});
