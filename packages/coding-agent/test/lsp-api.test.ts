import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lspDefinition, lspDocumentSymbols, lspHover, lspReferences, lspWorkspaceSymbols } from "../src/lsp/api.js";
import { shutdownAll } from "../src/lsp/client.js";

const createdDirs: string[] = [];

function createFakeServerFixture(): { cwd: string; filePath: string } {
	const cwd = mkdtempSync(join(tmpdir(), "lsp-api-test-"));
	createdDirs.push(cwd);
	const filePath = join(cwd, "index.ts");
	writeFileSync(filePath, "const value = 1;\n");

	const serverPath = join(cwd, "fake-lsp-server.cjs");
	const serverSource = `
let buffer = "";
function writeMessage(payload) {
  const text = JSON.stringify(payload);
  process.stdout.write("Content-Length: " + Buffer.byteLength(text, "utf8") + "\\r\\n\\r\\n" + text);
}
function readMessage() {
  const headerEnd = buffer.indexOf("\\r\\n\\r\\n");
  if (headerEnd < 0) return null;
  const header = buffer.slice(0, headerEnd);
  const match = /Content-Length:\\s*(\\d+)/i.exec(header);
  if (!match) return null;
  const length = Number.parseInt(match[1], 10);
  const messageStart = headerEnd + 4;
  const messageEnd = messageStart + length;
  if (buffer.length < messageEnd) return null;
  const body = buffer.slice(messageStart, messageEnd);
  buffer = buffer.slice(messageEnd);
  return JSON.parse(body);
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let message = readMessage();
  while (message) {
    if (message.method === "initialize") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: { capabilities: {} } });
    } else if (message.method === "textDocument/hover") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: { contents: { kind: "markdown", value: "hover info" } } });
    } else if (message.method === "textDocument/definition") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: [{ uri: "file:///tmp/def.ts", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } }] });
    } else if (message.method === "textDocument/references") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: [{ uri: "file:///tmp/ref.ts", range: { start: { line: 1, character: 0 }, end: { line: 1, character: 4 } } }] });
    } else if (message.method === "textDocument/documentSymbol") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: [{ name: "value", kind: 13, range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } }, selectionRange: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } } }] });
    } else if (message.method === "workspace/symbol") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: [{ name: "value", kind: 13, location: { uri: "file:///tmp/workspace.ts", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } } } }] });
    } else if (message.method === "shutdown") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: null });
      process.exit(0);
    } else if (message.id !== undefined) {
      writeMessage({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "unknown method" } });
    }
    message = readMessage();
  }
});
`;
	writeFileSync(serverPath, serverSource, "utf8");

	const lspConfigPath = join(cwd, "lsp.json");
	writeFileSync(
		lspConfigPath,
		JSON.stringify(
			{
				servers: {
					"typescript-language-server": {
						command: process.execPath,
						args: [serverPath],
						languages: ["typescript"],
					},
				},
			},
			null,
			2,
		),
	);

	return { cwd, filePath };
}

afterEach(() => {
	shutdownAll();
	for (const dir of createdDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("lsp api read-only operations", () => {
	it("executes hover/definition/references/symbol operations", async () => {
		const { cwd, filePath } = createFakeServerFixture();

		const hover = await lspHover({ cwd, filePath, line: 1, column: 1 });
		expect(hover.contents).toContain("hover info");

		const definition = await lspDefinition({ cwd, filePath, line: 1, column: 1 });
		expect(definition.locations).toHaveLength(1);
		expect(definition.locations[0].uri).toContain("def.ts");

		const references = await lspReferences({ cwd, filePath, line: 1, column: 1 });
		expect(references.references).toHaveLength(1);
		expect(references.references[0].uri).toContain("ref.ts");

		const symbols = await lspDocumentSymbols({ cwd, filePath });
		expect(symbols.symbols).toHaveLength(1);

		const workspace = await lspWorkspaceSymbols({ cwd, query: "value" });
		expect(workspace.symbols).toHaveLength(1);
		expect(workspace.symbols[0].name).toBe("value");
	});
});
