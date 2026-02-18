import { basename, extname } from "node:path";

const LANGUAGE_MAP: Record<string, string> = {
	".ts": "typescript",
	".tsx": "typescriptreact",
	".js": "javascript",
	".jsx": "javascriptreact",
	".mjs": "javascript",
	".cjs": "javascript",
	".mts": "typescript",
	".cts": "typescript",
	".rs": "rust",
	".go": "go",
	".py": "python",
	".html": "html",
	".htm": "html",
	".css": "css",
	".scss": "scss",
	".sass": "sass",
	".less": "less",
	".json": "json",
	".jsonc": "jsonc",
	".md": "markdown",
};

export function detectLanguageIdFromPath(filePath: string): string | undefined {
	const fileBaseName = basename(filePath).toLowerCase();
	if (fileBaseName === "dockerfile" || fileBaseName.startsWith("dockerfile.")) {
		return "dockerfile";
	}

	return LANGUAGE_MAP[extname(filePath).toLowerCase()];
}
