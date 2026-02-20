import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getOrCreateClient, sendRequest, shutdownAll } from "../src/lsp/client.js";
import type { ServerConfig } from "../src/lsp/types.js";

const createdDirs: string[] = [];

function createFakeServerScript(): { cwd: string; scriptPath: string } {
	const cwd = mkdtempSync(join(tmpdir(), "lsp-client-test-"));
	createdDirs.push(cwd);
	const scriptPath = join(cwd, "fake-lsp-server.cjs");
	const source = `
let buffer = "";
function writeMessage(payload) {
  const text = JSON.stringify(payload);
  process.stdout.write("Content-Length: " + Buffer.byteLength(text, "utf8") + "\\r\\n\\r\\n" + text);
}
function tryReadMessage() {
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
  let message = tryReadMessage();
  while (message) {
    if (message.method === "initialize") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: { capabilities: {} } });
    } else if (message.method === "test/echo") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: message.params });
    } else if (message.method === "shutdown") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: null });
      process.exit(0);
    } else if (message.id !== undefined) {
      writeMessage({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "unknown method" } });
    }
    message = tryReadMessage();
  }
});
`;
	writeFileSync(scriptPath, source, "utf8");
	return { cwd, scriptPath };
}

function createCrashOnceServerScript(): { cwd: string; scriptPath: string } {
	const cwd = mkdtempSync(join(tmpdir(), "lsp-client-test-"));
	createdDirs.push(cwd);
	const scriptPath = join(cwd, "crash-once-lsp-server.cjs");
	const markerPath = join(cwd, "crashed-once.marker");
	const source = `
const fs = require("node:fs");
const markerPath = ${JSON.stringify(markerPath)};
let buffer = "";
function writeMessage(payload) {
  const text = JSON.stringify(payload);
  process.stdout.write("Content-Length: " + Buffer.byteLength(text, "utf8") + "\\r\\n\\r\\n" + text);
}
function tryReadMessage() {
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
  let message = tryReadMessage();
  while (message) {
    if (message.method === "initialize") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: { capabilities: {} } });
    } else if (message.method === "test/echo") {
      if (!fs.existsSync(markerPath)) {
        fs.writeFileSync(markerPath, "crashed");
        process.exit(1);
      }
      writeMessage({ jsonrpc: "2.0", id: message.id, result: message.params });
    } else if (message.method === "shutdown") {
      writeMessage({ jsonrpc: "2.0", id: message.id, result: null });
      process.exit(0);
    } else if (message.id !== undefined) {
      writeMessage({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "unknown method" } });
    }
    message = tryReadMessage();
  }
});
`;
	writeFileSync(scriptPath, source, "utf8");
	return { cwd, scriptPath };
}

afterEach(() => {
	shutdownAll();
	for (const dir of createdDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("lsp client transport", () => {
	it("initializes and handles request/response lifecycle", async () => {
		const { cwd, scriptPath } = createFakeServerScript();
		const config: ServerConfig = {
			command: process.execPath,
			args: [scriptPath],
			fileTypes: ["typescript"],
		};

		const client = await getOrCreateClient(config, cwd, 2_000);
		const result = await sendRequest(client, "test/echo", { value: "ok" }, undefined, 2_000);
		expect(result).toEqual({ value: "ok" });
	});

	it("evicts terminated clients so the same server can reconnect", async () => {
		const { cwd, scriptPath } = createCrashOnceServerScript();
		const config: ServerConfig = {
			command: process.execPath,
			args: [scriptPath],
			fileTypes: ["typescript"],
		};

		const firstClient = await getOrCreateClient(config, cwd, 2_000);
		await expect(sendRequest(firstClient, "test/echo", { value: "first" }, undefined, 2_000)).rejects.toThrow();
		expect(readFileSync(join(cwd, "crashed-once.marker"), "utf8")).toContain("crashed");

		const secondClient = await getOrCreateClient(config, cwd, 2_000);
		const secondResult = await sendRequest(secondClient, "test/echo", { value: "second" }, undefined, 2_000);
		expect(secondResult).toEqual({ value: "second" });
	});
});
