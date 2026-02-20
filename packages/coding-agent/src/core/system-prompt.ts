/**
 * System prompt construction and project context loading
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDocsPath, getExamplesPath, getReadmePath } from "../config.js";
import { formatSkillsForPrompt, type Skill } from "./skills.js";

/** Tool descriptions for system prompt */
const toolDescriptions: Record<string, string> = {
	read: "Read file contents",
	bash: "Execute bash commands (ls, grep, find, etc.)",
	edit: "Make surgical edits to files (find exact text and replace)",
	write: "Create or overwrite files",
	lsp: "Run language intelligence queries (hover, definition, references, symbols)",
	"ast-grep": "Run syntax-aware structural search and rewrites (if installed)",
	grep: "Search file contents for patterns (respects .gitignore)",
	find: "Find files by glob pattern (respects .gitignore)",
	ls: "List directory contents",
};

export interface BuildSystemPromptOptions {
	/** Custom system prompt (replaces default). */
	customPrompt?: string;
	/** Tools to include in prompt. Default: [read, bash, edit, write, lsp, ast-grep] */
	selectedTools?: string[];
	/** Text to append to system prompt. */
	appendSystemPrompt?: string;
	/** Working directory. Default: process.cwd() */
	cwd?: string;
	/** Pre-loaded context files. */
	contextFiles?: Array<{ path: string; content: string }>;
	/** Pre-loaded skills. */
	skills?: Skill[];
	/** Override ast-grep availability detection. */
	astGrepAvailable?: boolean;
}

function detectAstGrepAvailability(): boolean {
	const command = process.platform === "win32" ? "where" : "which";
	const hasSg = spawnSync(command, ["sg"], { stdio: "ignore" }).status === 0;
	if (hasSg) {
		return true;
	}
	return spawnSync(command, ["ast-grep"], { stdio: "ignore" }).status === 0;
}

function stripFrontmatter(markdown: string): string {
	if (!markdown.startsWith("---")) {
		return markdown.trim();
	}
	const secondFence = markdown.indexOf("\n---", 3);
	if (secondFence === -1) {
		return markdown.trim();
	}
	return markdown.slice(secondFence + 4).trim();
}

function loadPromptTemplate(fileName: string): string | undefined {
	const promptPath = resolve(dirname(fileURLToPath(import.meta.url)), `../../prompts/${fileName}`);
	if (!existsSync(promptPath)) {
		return undefined;
	}
	return stripFrontmatter(readFileSync(promptPath, "utf-8"));
}

function loadCapabilityPolicyTemplate(astGrepAvailable: boolean): string | undefined {
	const basePolicy = loadPromptTemplate("capability-aware-coding.md");
	if (!basePolicy) {
		return undefined;
	}
	const astGrepPolicy = loadPromptTemplate("capability-aware-ast-grep.md");
	const astGrepLines = astGrepPolicy
		? astGrepPolicy
				.split("\n")
				.filter((line) =>
					astGrepAvailable
						? !line.includes("If `ast-grep=unavailable`,")
						: !line.includes("If `ast-grep=available`,"),
				)
		: [];

	const combined = [basePolicy.trim(), ...astGrepLines.filter((line) => line.trim().length > 0)].join("\n");
	return combined.trim();
}

/** Build the system prompt with tools, guidelines, and context */
export function buildSystemPrompt(options: BuildSystemPromptOptions = {}): string {
	const {
		customPrompt,
		selectedTools,
		appendSystemPrompt,
		cwd,
		contextFiles: providedContextFiles,
		skills: providedSkills,
		astGrepAvailable,
	} = options;
	const resolvedCwd = cwd ?? process.cwd();
	const resolvedAstGrepAvailability = astGrepAvailable ?? detectAstGrepAvailability();
	const capabilityPolicy = loadCapabilityPolicyTemplate(resolvedAstGrepAvailability);

	const now = new Date();
	const dateTime = now.toLocaleString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short",
	});

	const appendParts = [appendSystemPrompt, capabilityPolicy].filter(
		(part): part is string => !!part && part.trim().length > 0,
	);
	const appendSection = appendParts.length > 0 ? `\n\n${appendParts.join("\n\n")}` : "";

	const contextFiles = providedContextFiles ?? [];
	const skills = providedSkills ?? [];

	if (customPrompt) {
		let prompt = customPrompt;

		if (appendSection) {
			prompt += appendSection;
		}

		// Append project context files
		if (contextFiles.length > 0) {
			prompt += "\n\n# Project Context\n\n";
			prompt += "Project-specific instructions and guidelines:\n\n";
			for (const { path: filePath, content } of contextFiles) {
				prompt += `## ${filePath}\n\n${content}\n\n`;
			}
		}

		// Append skills section (only if read tool is available)
		const customPromptHasRead = !selectedTools || selectedTools.includes("read");
		if (customPromptHasRead && skills.length > 0) {
			prompt += formatSkillsForPrompt(skills);
		}

		// Add date/time and working directory last
		prompt += `\nCurrent date and time: ${dateTime}`;
		prompt += `\nCurrent working directory: ${resolvedCwd}`;

		return prompt;
	}

	// Get absolute paths to documentation and examples
	const readmePath = getReadmePath();
	const docsPath = getDocsPath();
	const examplesPath = getExamplesPath();

	// Build tools list based on selected tools (only built-in tools with known descriptions)
	const tools = (selectedTools || ["read", "bash", "edit", "write", "lsp", "ast-grep"]).filter(
		(t) => t in toolDescriptions,
	);
	const toolsList = tools.length > 0 ? tools.map((t) => `- ${t}: ${toolDescriptions[t]}`).join("\n") : "(none)";

	// Build guidelines based on which tools are actually available
	const guidelinesList: string[] = [];

	const hasBash = tools.includes("bash");
	const hasEdit = tools.includes("edit");
	const hasWrite = tools.includes("write");
	const hasGrep = tools.includes("grep");
	const hasFind = tools.includes("find");
	const hasLs = tools.includes("ls");
	const hasRead = tools.includes("read");
	const hasLsp = tools.includes("lsp");
	const hasAstGrep = tools.includes("ast-grep");

	// File exploration guidelines
	if (hasBash && !hasGrep && !hasFind && !hasLs) {
		guidelinesList.push("Use bash for file operations like ls, rg, find");
	} else if (hasBash && (hasGrep || hasFind || hasLs)) {
		guidelinesList.push("Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)");
	}

	// Read before edit guideline
	if (hasRead && hasEdit) {
		guidelinesList.push("Use read to examine files before editing. You must use this tool instead of cat or sed.");
	}

	// Edit guideline
	if (hasEdit) {
		guidelinesList.push("Use edit for precise changes (old text must match exactly)");
	}

	// Write guideline
	if (hasWrite) {
		guidelinesList.push("Use write only for new files or complete rewrites");
	}

	// LSP usage guidelines
	if (hasLsp) {
		guidelinesList.push(
			"Use LSP for semantic navigation when available; otherwise fall back to read/grep/find workflows.",
		);
		guidelinesList.push(
			"For requests about references/definitions/hover/symbols/rename/diagnostics, start with a concrete LSP call before text search.",
		);
	}
	if (hasAstGrep) {
		guidelinesList.push("Use ast-grep for syntax-aware structural queries and bulk code-shape matching.");
	}

	// Output guideline (only when actually writing or executing)
	if (hasEdit || hasWrite) {
		guidelinesList.push(
			"When summarizing your actions, output plain text directly - do NOT use cat or bash to display what you did",
		);
	}

	// Always include these
	guidelinesList.push("Be concise in your responses");
	guidelinesList.push("Show file paths clearly when working with files");

	const guidelines = guidelinesList.map((g) => `- ${g}`).join("\n");

	let prompt = `You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.

Available tools:
${toolsList}

In addition to the tools above, you may have access to other custom tools depending on the project.

Guidelines:
${guidelines}

Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):
- Main documentation: ${readmePath}
- Additional docs: ${docsPath}
- Examples: ${examplesPath} (extensions, custom tools, SDK)
- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), pi packages (docs/packages.md)
- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing
- Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details)`;

	if (appendSection) {
		prompt += appendSection;
	}

	// Append project context files
	if (contextFiles.length > 0) {
		prompt += "\n\n# Project Context\n\n";
		prompt += "Project-specific instructions and guidelines:\n\n";
		for (const { path: filePath, content } of contextFiles) {
			prompt += `## ${filePath}\n\n${content}\n\n`;
		}
	}

	// Append skills section (only if read tool is available)
	if (hasRead && skills.length > 0) {
		prompt += formatSkillsForPrompt(skills);
	}

	// Add date/time and working directory last
	prompt += `\nCurrent date and time: ${dateTime}`;
	prompt += `\nCurrent working directory: ${resolvedCwd}`;

	return prompt;
}
