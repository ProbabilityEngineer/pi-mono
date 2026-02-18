import { describe, expect, it } from "vitest";
import { isLspmuxSupported, wrapWithLspmux } from "../src/lsp/lspmux.js";
import type { LspmuxState } from "../src/lsp/types.js";

describe("lspmux integration", () => {
	it("recognizes default supported servers", () => {
		expect(isLspmuxSupported("rust-analyzer")).toBe(true);
		expect(isLspmuxSupported("/usr/local/bin/rust-analyzer")).toBe(true);
		expect(isLspmuxSupported("typescript-language-server")).toBe(false);
	});

	it("falls back to original command when lspmux is unavailable", () => {
		const state: LspmuxState = { available: false, running: false, binaryPath: null };
		const wrapped = wrapWithLspmux("rust-analyzer", ["--stdio"], state);
		expect(wrapped).toEqual({ command: "rust-analyzer", args: ["--stdio"] });
	});

	it("wraps supported servers when lspmux is available", () => {
		const state: LspmuxState = { available: true, running: true, binaryPath: "/usr/bin/lspmux" };
		const wrapped = wrapWithLspmux("rust-analyzer", ["--stdio"], state);
		expect(wrapped.command).toBe("/usr/bin/lspmux");
		expect(wrapped.args).toEqual(["client", "--", "--stdio"]);
		expect(wrapped.env?.LSPMUX_SERVER).toBe("rust-analyzer");
	});
});
