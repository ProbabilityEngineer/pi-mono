import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { pickServerForOperation } from "../src/lsp/api.js";
import {
	getServersForLanguage,
	isCommandAvailable,
	lspDiagnostics,
	lspDocumentSymbols,
	shutdownAll,
} from "../src/lsp/index.js";
import type { ResolvedLspServer } from "../src/lsp/types.js";

const LIVE = process.env.PI_LSP_LIVE === "1";
const tempDirs: string[] = [];

afterAll(() => {
	shutdownAll();
	for (const dir of tempDirs.splice(0)) {
		if (existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
	}
});

interface LiveScenario {
	name: string;
	languageId: string;
	fileName: string;
	content: string;
}

const LIVE_SCENARIOS: LiveScenario[] = [
	{
		name: "typescript",
		languageId: "typescript",
		fileName: "index.ts",
		content: "export function add(a: number, b: number) { return a + b; }\n",
	},
	{
		name: "python",
		languageId: "python",
		fileName: "main.py",
		content: "def add(a: int, b: int) -> int:\n    return a + b\n",
	},
	{
		name: "json",
		languageId: "json",
		fileName: "package.json",
		content: '{\n  "name": "live-matrix",\n  "version": "1.0.0"\n}\n',
	},
];

function getAvailableServers(languageId: string, cwd: string): ResolvedLspServer[] {
	return getServersForLanguage(languageId, cwd).filter((server) => isCommandAvailable(server.command, cwd));
}

describe.skipIf(!LIVE)("lsp live validation matrix", () => {
	test("validates multi-language server selection and role routing evidence", async () => {
		const cwd = mkdtempSync(join(tmpdir(), "pi-lsp-live-matrix-"));
		tempDirs.push(cwd);

		writeFileSync(join(cwd, "package.json"), '{ "name": "pi-lsp-live-matrix", "private": true }\n');
		writeFileSync(join(cwd, "pyproject.toml"), '[project]\nname = "pi-lsp-live-matrix"\nversion = "0.0.1"\n');

		interface EvidenceRow {
			language: string;
			intelligenceServer: string;
			linterServer?: string;
		}

		const evidence: EvidenceRow[] = [];
		let validatedLanguages = 0;
		let dualRoleValidated = false;

		for (const scenario of LIVE_SCENARIOS) {
			const filePath = join(cwd, scenario.fileName);
			writeFileSync(filePath, scenario.content);

			const available = getAvailableServers(scenario.languageId, cwd);
			if (available.length === 0) {
				continue;
			}

			const intelligenceExpected = pickServerForOperation(available, "intelligence");
			if (!intelligenceExpected) {
				continue;
			}

			const intelligenceResult = await lspDocumentSymbols({
				cwd,
				filePath: scenario.fileName,
			});

			expect(intelligenceResult.server).toBe(intelligenceExpected.name);

			const row: EvidenceRow = {
				language: scenario.languageId,
				intelligenceServer: intelligenceResult.server,
			};

			const hasDualRole =
				available.some((server) => server.isLinter) && available.some((server) => !server.isLinter);
			if (hasDualRole) {
				const linterExpected = pickServerForOperation(available, "linter");
				expect(linterExpected).toBeDefined();
				const diagnosticsResult = await lspDiagnostics({
					cwd,
					filePath: scenario.fileName,
				});
				expect(diagnosticsResult.server).toBe(linterExpected?.name);
				row.linterServer = diagnosticsResult.server;
				dualRoleValidated = true;
			}

			evidence.push(row);
			validatedLanguages += 1;
		}

		expect(validatedLanguages).toBeGreaterThanOrEqual(2);
		expect(evidence.length).toBeGreaterThanOrEqual(2);
		if (dualRoleValidated) {
			expect(evidence.some((row) => row.linterServer !== undefined)).toBe(true);
		}
	}, 120_000);
});
