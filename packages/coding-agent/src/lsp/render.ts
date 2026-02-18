import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic, WorkspaceEdit } from "./types.js";

function pathFromUri(uri: string, cwd: string): string {
	if (!uri.startsWith("file://")) {
		return uri;
	}
	try {
		const absolute = fileURLToPath(uri);
		return relative(cwd, absolute) || absolute;
	} catch {
		return uri;
	}
}

export function formatDiagnostics(diagnostics: Diagnostic[], fileUri: string, cwd: string): string[] {
	const filePath = pathFromUri(fileUri, cwd);
	return diagnostics.map((diagnostic) => {
		const line = diagnostic.range.start.line + 1;
		const column = diagnostic.range.start.character + 1;
		const severity =
			diagnostic.severity === 1
				? "error"
				: diagnostic.severity === 2
					? "warning"
					: diagnostic.severity === 3
						? "info"
						: "hint";
		return `${filePath}:${line}:${column} [${severity}] ${diagnostic.message}`;
	});
}

export function formatWorkspaceEdit(edit: WorkspaceEdit, cwd: string): string[] {
	const lines: string[] = [];
	for (const [uri, textEdits] of Object.entries(edit.changes ?? {})) {
		lines.push(`${pathFromUri(uri, cwd)}: ${textEdits.length} edit(s)`);
	}
	for (const change of edit.documentChanges ?? []) {
		if ("edits" in change) {
			lines.push(`${pathFromUri(change.textDocument.uri, cwd)}: ${change.edits.length} edit(s)`);
			continue;
		}
		if (change.kind === "create") {
			lines.push(`create ${pathFromUri(change.uri, cwd)}`);
			continue;
		}
		if (change.kind === "rename") {
			lines.push(`rename ${pathFromUri(change.oldUri, cwd)} -> ${pathFromUri(change.newUri, cwd)}`);
			continue;
		}
		if (change.kind === "delete") {
			lines.push(`delete ${pathFromUri(change.uri, cwd)}`);
		}
	}
	return lines;
}
