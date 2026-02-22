import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static, Type } from "@sinclair/typebox";
import { constants } from "fs";
import { access as fsAccess, readFile as fsReadFile, writeFile as fsWriteFile } from "fs/promises";
import {
	detectLineEnding,
	fuzzyFindText,
	generateDiffString,
	normalizeForFuzzyMatch,
	normalizeToLF,
	restoreLineEndings,
	stripBom,
} from "./edit-diff.js";
import { type AffectedLineRange, applyHashlineEdits, type HashlineEditOperation } from "./hashline.js";
import { resolveToCwd } from "./path-utils.js";

const replaceEditSchema = Type.Object({
	path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
	oldText: Type.String({ description: "Exact text to find and replace (must match exactly)" }),
	newText: Type.String({ description: "New text to replace the old text with" }),
});

const hashlineSingleSchema = Type.Object({
	set_line: Type.Object({
		anchor: Type.String({ description: 'Line reference "<lineNumber>#<hash>" (example: "12#49c4e9")' }),
		new_text: Type.String({ description: "Replacement content (empty string deletes the line)" }),
	}),
});

const hashlineRangeSchema = Type.Object({
	replace_lines: Type.Object({
		start_anchor: Type.String({ description: 'Start line reference "<lineNumber>#<hash>" (example: "12#49c4e9")' }),
		end_anchor: Type.String({ description: 'End line reference "<lineNumber>#<hash>" (example: "12#49c4e9")' }),
		new_text: Type.String({ description: "Replacement content (empty string deletes the range)" }),
	}),
});

const hashlineInsertSchema = Type.Object({
	insert_after: Type.Object({
		anchor: Type.String({
			description: 'Insert after this line reference "<lineNumber>#<hash>" (example: "12#49c4e9")',
		}),
		text: Type.String({ description: "Content to insert" }),
	}),
});

const hashlineEditSchema = Type.Object({
	path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
	edits: Type.Array(Type.Union([hashlineSingleSchema, hashlineRangeSchema, hashlineInsertSchema])),
});

type EditSchema = typeof replaceEditSchema | typeof hashlineEditSchema;
type ReplaceEditToolInput = Static<typeof replaceEditSchema>;
type HashlineEditToolInput = Static<typeof hashlineEditSchema>;
export type EditToolInput = ReplaceEditToolInput | HashlineEditToolInput;
export type EditMode = "replace" | "hashline";

export interface EditToolDetails {
	/** Unified diff of the changes made */
	diff: string;
	/** Line number of the first change in the new file (for editor navigation) */
	firstChangedLine?: number;
	/** Line ranges that need fresh hashes due to hash mismatch (for partial re-read) */
	affectedLineRanges?: AffectedLineRange[];
}

/**
 * Pluggable operations for the edit tool.
 * Override these to delegate file editing to remote systems (e.g., SSH).
 */
export interface EditOperations {
	/** Read file contents as a Buffer */
	readFile: (absolutePath: string) => Promise<Buffer>;
	/** Write content to a file */
	writeFile: (absolutePath: string, content: string) => Promise<void>;
	/** Check if file is readable and writable (throw if not) */
	access: (absolutePath: string) => Promise<void>;
}

const defaultEditOperations: EditOperations = {
	readFile: (path) => fsReadFile(path),
	writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
	access: (path) => fsAccess(path, constants.R_OK | constants.W_OK),
};

export interface EditToolOptions {
	/** Custom operations for file editing. Default: local filesystem */
	operations?: EditOperations;
	/** Edit mode variant. Default: "replace" unless PI_EDIT_VARIANT=hashline. */
	editMode?: EditMode;
	/** Optional callback invoked when this tool accesses a file path. */
	onPathAccess?: (path: string) => Promise<string | undefined> | string | undefined;
}

function resolveEditMode(options?: EditToolOptions): EditMode {
	if (options?.editMode) {
		return options.editMode;
	}
	const envMode = process.env.PI_EDIT_VARIANT;
	if (envMode === "hashline") {
		return "hashline";
	}
	return "replace";
}

export function createEditTool(cwd: string, options?: EditToolOptions): AgentTool<EditSchema> {
	const ops = options?.operations ?? defaultEditOperations;
	const mode = resolveEditMode(options);
	const schema = mode === "hashline" ? hashlineEditSchema : replaceEditSchema;
	const description =
		mode === "hashline"
			? 'Edit files with hash-verified line references. Use "edits" with operations: set_line, replace_lines, insert_after.'
			: "Edit a file by replacing exact text. The oldText must match exactly (including whitespace). Use this for precise, surgical edits.";

	return {
		name: "edit",
		label: "edit",
		description,
		parameters: schema,
		execute: async (_toolCallId: string, params: EditToolInput, signal?: AbortSignal) => {
			if (mode === "hashline") {
				const { path, edits } = params as HashlineEditToolInput;
				const lspNote = await options?.onPathAccess?.(path);
				const absolutePath = resolveToCwd(path, cwd);
				const parsedEdits = edits as HashlineEditOperation[];

				// Validate file exists and can be accessed first for consistent errors.
				try {
					await ops.access(absolutePath);
				} catch {
					throw new Error(`File not found: ${path}`);
				}

				const rawContent = (await ops.readFile(absolutePath)).toString("utf-8");
				const { bom, text: content } = stripBom(rawContent);
				const originalEnding = detectLineEnding(content);
				const normalizedContent = normalizeToLF(content);
				const result = applyHashlineEdits(normalizedContent, parsedEdits);

				if (result.content === normalizedContent) {
					throw new Error(`No changes made to ${path}. The edits produced identical content.`);
				}

				const finalContent = bom + restoreLineEndings(result.content, originalEnding);
				await ops.writeFile(absolutePath, finalContent);

				const diffResult = generateDiffString(normalizedContent, result.content);
				return {
					content: [
						{
							type: "text",
							text: lspNote
								? `Successfully applied hashline edits to ${path}.\n\n[LSP] ${lspNote}`
								: `Successfully applied hashline edits to ${path}.`,
						},
					],
					details: {
						diff: diffResult.diff,
						firstChangedLine: result.firstChangedLine ?? diffResult.firstChangedLine,
						affectedLineRanges: result.affectedLineRanges,
					},
				};
			}

			const { path, oldText, newText } = params as ReplaceEditToolInput;
			const lspNote = await options?.onPathAccess?.(path);
			const absolutePath = resolveToCwd(path, cwd);

			return new Promise<{
				content: Array<{ type: "text"; text: string }>;
				details: EditToolDetails | undefined;
			}>((resolve, reject) => {
				// Check if already aborted
				if (signal?.aborted) {
					reject(new Error("Operation aborted"));
					return;
				}

				let aborted = false;

				// Set up abort handler
				const onAbort = () => {
					aborted = true;
					reject(new Error("Operation aborted"));
				};

				if (signal) {
					signal.addEventListener("abort", onAbort, { once: true });
				}

				// Perform the edit operation
				(async () => {
					try {
						// Check if file exists
						try {
							await ops.access(absolutePath);
						} catch {
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}
							reject(new Error(`File not found: ${path}`));
							return;
						}

						// Check if aborted before reading
						if (aborted) {
							return;
						}

						// Read the file
						const buffer = await ops.readFile(absolutePath);
						const rawContent = buffer.toString("utf-8");

						// Check if aborted after reading
						if (aborted) {
							return;
						}

						// Strip BOM before matching (LLM won't include invisible BOM in oldText)
						const { bom, text: content } = stripBom(rawContent);

						const originalEnding = detectLineEnding(content);
						const normalizedContent = normalizeToLF(content);
						const normalizedOldText = normalizeToLF(oldText);
						const normalizedNewText = normalizeToLF(newText);

						// Find the old text using fuzzy matching (tries exact match first, then fuzzy)
						const matchResult = fuzzyFindText(normalizedContent, normalizedOldText);

						if (!matchResult.found) {
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}
							reject(
								new Error(
									`Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`,
								),
							);
							return;
						}

						// Count occurrences using fuzzy-normalized content for consistency
						const fuzzyContent = normalizeForFuzzyMatch(normalizedContent);
						const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
						const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;

						if (occurrences > 1) {
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}
							reject(
								new Error(
									`Found ${occurrences} occurrences of the text in ${path}. The text must be unique. Please provide more context to make it unique.`,
								),
							);
							return;
						}

						// Check if aborted before writing
						if (aborted) {
							return;
						}

						// Perform replacement using the matched text position
						// When fuzzy matching was used, contentForReplacement is the normalized version
						const baseContent = matchResult.contentForReplacement;
						const newContent =
							baseContent.substring(0, matchResult.index) +
							normalizedNewText +
							baseContent.substring(matchResult.index + matchResult.matchLength);

						// Verify the replacement actually changed something
						if (baseContent === newContent) {
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}
							reject(
								new Error(
									`No changes made to ${path}. The replacement produced identical content. This might indicate an issue with special characters or the text not existing as expected.`,
								),
							);
							return;
						}

						const finalContent = bom + restoreLineEndings(newContent, originalEnding);
						await ops.writeFile(absolutePath, finalContent);

						// Check if aborted after writing
						if (aborted) {
							return;
						}

						// Clean up abort handler
						if (signal) {
							signal.removeEventListener("abort", onAbort);
						}

						const diffResult = generateDiffString(baseContent, newContent);
						resolve({
							content: [
								{
									type: "text",
									text: lspNote
										? `Successfully replaced text in ${path}.\n\n[LSP] ${lspNote}`
										: `Successfully replaced text in ${path}.`,
								},
							],
							details: { diff: diffResult.diff, firstChangedLine: diffResult.firstChangedLine },
						});
					} catch (error: any) {
						// Clean up abort handler
						if (signal) {
							signal.removeEventListener("abort", onAbort);
						}

						if (!aborted) {
							reject(error);
						}
					}
				})();
			});
		},
	};
}

/** Default edit tool using process.cwd() - for backwards compatibility */
export const editTool = createEditTool(process.cwd());
