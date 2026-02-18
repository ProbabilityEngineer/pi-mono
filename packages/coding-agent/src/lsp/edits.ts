import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DocumentChange, TextEdit, WorkspaceEdit } from "./types.js";

function offsetAt(content: string, line: number, character: number): number {
	const normalizedLine = Math.max(0, line);
	const normalizedCharacter = Math.max(0, character);
	const lines = content.split("\n");
	let offset = 0;
	for (let index = 0; index < normalizedLine && index < lines.length; index += 1) {
		offset += lines[index].length + 1;
	}
	const lineText = lines[Math.min(normalizedLine, Math.max(0, lines.length - 1))] ?? "";
	return offset + Math.min(normalizedCharacter, lineText.length);
}

export function applyTextEditsToString(content: string, edits: TextEdit[]): string {
	const sorted = [...edits].sort((a, b) => {
		const aLine = a.range.start.line - b.range.start.line;
		if (aLine !== 0) {
			return aLine;
		}
		return a.range.start.character - b.range.start.character;
	});

	let result = "";
	let cursor = 0;

	for (const edit of sorted) {
		const start = offsetAt(content, edit.range.start.line, edit.range.start.character);
		const end = offsetAt(content, edit.range.end.line, edit.range.end.character);
		result += content.slice(cursor, start);
		result += edit.newText;
		cursor = end;
	}

	result += content.slice(cursor);
	return result;
}

async function applyChange(uri: string, edits: TextEdit[]): Promise<string> {
	const path = fileURLToPath(uri);
	const existing = await readFile(path, "utf8");
	const next = applyTextEditsToString(existing, edits);
	await writeFile(path, next, "utf8");
	return `Edited ${path}`;
}

async function applyDocumentChange(change: DocumentChange): Promise<string | undefined> {
	if ("edits" in change) {
		const path = fileURLToPath(change.textDocument.uri);
		const existing = await readFile(path, "utf8");
		const next = applyTextEditsToString(existing, change.edits);
		await writeFile(path, next, "utf8");
		return `Edited ${path}`;
	}

	if (change.kind === "create") {
		const path = fileURLToPath(change.uri);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, "", "utf8");
		return `Created ${path}`;
	}

	if (change.kind === "rename") {
		const oldPath = fileURLToPath(change.oldUri);
		const newPath = fileURLToPath(change.newUri);
		await mkdir(dirname(newPath), { recursive: true });
		await rename(oldPath, newPath);
		return `Renamed ${oldPath} -> ${newPath}`;
	}

	if (change.kind === "delete") {
		const path = fileURLToPath(change.uri);
		await rm(path, { force: true, recursive: true });
		return `Deleted ${path}`;
	}

	return undefined;
}

export async function applyWorkspaceEdit(edit: WorkspaceEdit): Promise<string[]> {
	const changes: string[] = [];

	for (const [uri, textEdits] of Object.entries(edit.changes ?? {})) {
		changes.push(await applyChange(uri, textEdits));
	}

	for (const documentChange of edit.documentChanges ?? []) {
		const applied = await applyDocumentChange(documentChange);
		if (applied) {
			changes.push(applied);
		}
	}

	return changes;
}
