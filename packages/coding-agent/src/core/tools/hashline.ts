import { createHash } from "node:crypto";

export interface HashlineRef {
	line: number;
	hash: string;
}

export type HashlineEditOperation =
	| { set_line: { anchor: string; new_text: string } }
	| { replace_lines: { start_anchor: string; end_anchor: string; new_text: string } }
	| { insert_after: { anchor: string; text: string } };

const HASHLINE_REF_RE = /(\d+)#([0-9a-fA-F]+)/;
const HASHLINE_TEXT_PREFIX_RE = /^\d+#[0-9a-fA-F]{2,}\|/;
const HASH_HEX_LENGTH = 6;
const MIN_COMPAT_HASH_HEX_LENGTH = 2;
const RECOVERY_WINDOW = 8;

function normalizeHashInput(line: string): string {
	if (line.endsWith("\r")) {
		line = line.slice(0, -1);
	}
	return line.replace(/\s+/g, "");
}

export function computeLineHash(_lineNum: number, line: string): string {
	const digest = createHash("sha1").update(normalizeHashInput(line), "utf8").digest("hex");
	return digest.slice(0, HASH_HEX_LENGTH);
}

export function formatHashLines(content: string, startLine = 1): string {
	const lines = content.split("\n");
	return lines
		.map((line, index) => {
			const lineNum = startLine + index;
			return `${lineNum}#${computeLineHash(lineNum, line)}|${line}`;
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
		throw new Error(`Invalid line reference "${ref}". Expected format "<lineNumber>#<hash>" (example: "12#49c4e9").`);
	}
	const line = Number.parseInt(match[1], 10);
	if (line < 1) {
		throw new Error(`Invalid line reference "${ref}". Line number must be >= 1.`);
	}
	const hash = match[2];
	if (hash.length < MIN_COMPAT_HASH_HEX_LENGTH) {
		throw new Error(
			`Invalid line reference "${ref}". Hash must contain at least ${MIN_COMPAT_HASH_HEX_LENGTH} hex chars.`,
		);
	}
	return { line, hash };
}

function hashMatches(expectedHashOrPrefix: string, actualHash: string): boolean {
	return actualHash.startsWith(expectedHashOrPrefix);
}

function assertNoHashlinePrefixedContent(text: string): void {
	const lines = text.split("\n");
	for (const line of lines) {
		if (HASHLINE_TEXT_PREFIX_RE.test(line)) {
			throw new Error("Do not include hashline prefixes in replacement text.");
		}
	}
}

function getMatchingLinesByHash(hash: string, fileLines: string[]): number[] {
	const matches: number[] = [];
	for (let i = 0; i < fileLines.length; i++) {
		if (hashMatches(hash, computeLineHash(i + 1, fileLines[i]))) {
			matches.push(i + 1);
		}
	}
	return matches;
}

function resolveLineRef(ref: HashlineRef, fileLines: string[]): HashlineRef {
	if (fileLines.length === 0) {
		throw new Error("Cannot apply hashline edits to an empty file.");
	}

	const inRange = ref.line >= 1 && ref.line <= fileLines.length;
	if (inRange) {
		const actualHash = computeLineHash(ref.line, fileLines[ref.line - 1]);
		if (hashMatches(ref.hash, actualHash)) {
			return ref;
		}
	}

	const windowStart = Math.max(1, ref.line - RECOVERY_WINDOW);
	const windowEnd = Math.min(fileLines.length, ref.line + RECOVERY_WINDOW);
	const nearbyMatches: number[] = [];
	for (let line = windowStart; line <= windowEnd; line++) {
		if (hashMatches(ref.hash, computeLineHash(line, fileLines[line - 1]))) {
			nearbyMatches.push(line);
		}
	}

	if (nearbyMatches.length === 1) {
		return { line: nearbyMatches[0], hash: ref.hash };
	}
	if (nearbyMatches.length > 1) {
		throw new Error(
			`Ambiguous hashline anchor "${ref.line}#${ref.hash}". Found multiple nearby matches at lines ${nearbyMatches.join(", ")}. Re-read the file and retry.`,
		);
	}

	const allMatches = getMatchingLinesByHash(ref.hash, fileLines);
	if (allMatches.length === 1) {
		return { line: allMatches[0], hash: ref.hash };
	}
	if (allMatches.length > 1) {
		throw new Error(
			`Ambiguous hashline anchor "${ref.line}#${ref.hash}". Found multiple matches at lines ${allMatches.join(", ")}. Re-read the file and retry.`,
		);
	}

	if (!inRange) {
		throw new Error(
			`Line ${ref.line} is out of range (file has ${fileLines.length} lines), and no matching hash ${ref.hash} was found.`,
		);
	}
	const actualHash = computeLineHash(ref.line, fileLines[ref.line - 1]);
	throw new Error(
		`Hash mismatch for line ${ref.line}. Expected ${ref.hash}, found ${actualHash}. Re-read the file and retry.`,
	);
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
			assertNoHashlinePrefixedContent(edit.set_line.new_text);
			const ref = resolveLineRef(parseLineRef(edit.set_line.anchor), originalLines);
			return { kind: "set_line" as const, ref, newText: edit.set_line.new_text, index };
		}
		if ("replace_lines" in edit) {
			assertNoHashlinePrefixedContent(edit.replace_lines.new_text);
			const startRef = resolveLineRef(parseLineRef(edit.replace_lines.start_anchor), originalLines);
			const endRef = resolveLineRef(parseLineRef(edit.replace_lines.end_anchor), originalLines);
			if (startRef.line > endRef.line) {
				throw new Error(`Invalid range: start line ${startRef.line} is after end line ${endRef.line}.`);
			}
			return { kind: "replace_lines" as const, startRef, endRef, newText: edit.replace_lines.new_text, index };
		}
		const ref = resolveLineRef(parseLineRef(edit.insert_after.anchor), originalLines);
		if (edit.insert_after.text.length === 0) {
			throw new Error("insert_after.text must not be empty.");
		}
		assertNoHashlinePrefixedContent(edit.insert_after.text);
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
