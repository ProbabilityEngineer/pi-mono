import { describe, expect, it } from "vitest";
import { getServersForLanguage } from "../src/lsp/config.js";

describe("lsp config server priority", () => {
	it("prefers primary TypeScript server over auxiliary servers", () => {
		const servers = getServersForLanguage("typescript", process.cwd());
		expect(servers.length).toBeGreaterThan(0);
		expect(servers[0]?.name).toBe("typescript-language-server");
	});

	it("prefers sourcekit-lsp over swiftlint for swift", () => {
		const servers = getServersForLanguage("swift", process.cwd());
		expect(servers.length).toBeGreaterThan(0);
		expect(servers[0]?.name).toBe("sourcekit-lsp");
	});
});
