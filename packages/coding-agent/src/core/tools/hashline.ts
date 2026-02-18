import { createHash } from "node:crypto";

export interface HashlineRef {
	line: number;
	hash: string;
}

export type HashlineEditOperation =
	| { set_line: { anchor: string; new_text: string } }
	| { replace_lines: { start_anchor: string; end_anchor: string; new_text: string } }
	| { insert_after: { anchor: string; text: string } };

const HASHLINE_REF_RE = /^(\d+):([0-9a-fA-F]+)$/;

function normalizeHashInput(line: string): string {
	if (line.endsWith("\r")) {
		line = line.slice(0, -1);
	}
	return line.replace(/\s+/g, "");
}

export function computeLineHash(_lineNum: number, line: string): string {
	const digest = createHash("sha1").update(normalizeHashInput(line), "utf8").digest("hex");
	return digest.slice(0, 2);
}

export function formatHashLines(content: string, startLine = 1): string {
	const lines = content.split("\n");
	return lines
		.map((line, index) => {
			const lineNum = startLine + index;
			return `${lineNum}:${computeLineHash(lineNum, line)}|${line}`;
		})
		.join("\n");
}

export function parseLineRef(ref: string): HashlineRef {
	const cleaned = ref
		.replace(/^>+\s*/, "")
		.replace(/\|.*$/, "")
		.trim()
		.toLowerCase();
	const match = cleaned.match(HASHLINE_REF_RE);
	if (!match) {
		throw new Error(`Invalid line reference "${ref}". Expected format "LINE:HASH".`);
	}
	const line = Number.parseInt(match[1], 10);
	if (line < 1) {
		throw new Error(`Invalid line reference "${ref}". Line number must be >= 1.`);
	}
	return { line, hash: match[2] };
}

function validateLineRef(ref: HashlineRef, fileLines: string[]): void {
	if (ref.line < 1 || ref.line > fileLines.length) {
		throw new Error(`Line ${ref.line} is out of range (file has ${fileLines.length} lines).`);
	}
	const actualHash = computeLineHash(ref.line, fileLines[ref.line - 1]);
	if (actualHash !== ref.hash) {
		throw new Error(
			`Hash mismatch for line ${ref.line}. Expected ${ref.hash}, found ${actualHash}. Re-read the file and retry.`,
		);
	}
}

export function applyHashlineEdits(
	content: string,
	edits: HashlineEditOperation[],
): { content: string; firstChangedLine: number | undefined } {
	if (edits.length === 0) {
		return { content, firstChangedLine: undefined };
	}

	const originalLines = content.split("\n");
	const nextLines = [...originalLines];
	let firstChangedLine: number | undefined;

	const parsedEdits = edits.map((edit, index) => {
		if ("set_line" in edit) {
			const ref = parseLineRef(edit.set_line.anchor);
			validateLineRef(ref, originalLines);
			return { kind: "set_line" as const, ref, newText: edit.set_line.new_text, index };
		}
		if ("replace_lines" in edit) {
			const startRef = parseLineRef(edit.replace_lines.start_anchor);
			const endRef = parseLineRef(edit.replace_lines.end_anchor);
			validateLineRef(startRef, originalLines);
			validateLineRef(endRef, originalLines);
			if (startRef.line > endRef.line) {
				throw new Error(`Invalid range: start line ${startRef.line} is after end line ${endRef.line}.`);
			}
			return { kind: "replace_lines" as const, startRef, endRef, newText: edit.replace_lines.new_text, index };
		}
		const ref = parseLineRef(edit.insert_after.anchor);
		validateLineRef(ref, originalLines);
		if (edit.insert_after.text.length === 0) {
			throw new Error("insert_after.text must not be empty.");
		}
		return { kind: "insert_after" as const, ref, text: edit.insert_after.text, index };
	});

	parsedEdits.sort((a, b) => {
		const aLine = a.kind === "replace_lines" ? a.endRef.line : a.ref.line;
		const bLine = b.kind === "replace_lines" ? b.endRef.line : b.ref.line;
		if (aLine !== bLine) {
			return bLine - aLine;
		}
		if (a.kind === "insert_after" && b.kind !== "insert_after") return 1;
		if (b.kind === "insert_after" && a.kind !== "insert_after") return -1;
		return a.index - b.index;
	});

	for (const edit of parsedEdits) {
		if (edit.kind === "set_line") {
			const replacement = edit.newText === "" ? [] : edit.newText.split("\n");
			nextLines.splice(edit.ref.line - 1, 1, ...replacement);
			firstChangedLine = firstChangedLine === undefined ? edit.ref.line : Math.min(firstChangedLine, edit.ref.line);
			continue;
		}

		if (edit.kind === "replace_lines") {
			const replacement = edit.newText === "" ? [] : edit.newText.split("\n");
			const deleteCount = edit.endRef.line - edit.startRef.line + 1;
			nextLines.splice(edit.startRef.line - 1, deleteCount, ...replacement);
			firstChangedLine =
				firstChangedLine === undefined ? edit.startRef.line : Math.min(firstChangedLine, edit.startRef.line);
			continue;
		}

		const inserted = edit.text.split("\n");
		nextLines.splice(edit.ref.line, 0, ...inserted);
		const changedLine = edit.ref.line + 1;
		firstChangedLine = firstChangedLine === undefined ? changedLine : Math.min(firstChangedLine, changedLine);
	}

	return { content: nextLines.join("\n"), firstChangedLine };
}
