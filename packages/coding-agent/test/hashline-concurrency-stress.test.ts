import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { computeLineHash } from "../src/core/tools/hashline.js";
import { createEditTool } from "../src/core/tools/index.js";

function firstLine(text: string): string {
	const normalized = text.endsWith("\n") ? text.slice(0, -1) : text;
	return normalized.split("\n")[0] ?? "";
}

function isHashlineMismatchError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	return /Hash mismatch|Ambiguous hashline anchor/.test(error.message);
}

interface RetryMetrics {
	attempts: number;
	retries: number;
	mismatches: number;
}

interface StressScenarioResult {
	finalContent: string;
	totalRetries: number;
	totalMismatches: number;
	metrics: RetryMetrics[];
}

async function runHashlineStressScenario(
	path: string,
	workers: number,
	maxAttempts: number,
	target: string,
): Promise<StressScenarioResult> {
	const editTool = createEditTool(dirname(path), { editMode: "hashline" });

	async function setWithRetry(workerId: number): Promise<RetryMetrics> {
		let attempts = 0;
		let mismatches = 0;

		while (attempts < maxAttempts) {
			attempts += 1;
			const current = firstLine(readFileSync(path, "utf8"));
			const anchor =
				attempts === 1
					? `1:${computeLineHash(1, current) === "000000" ? "000001" : "000000"}`
					: `1:${computeLineHash(1, current)}`;

			try {
				await editTool.execute(`stress-${workerId}-attempt-${attempts}`, {
					path,
					edits: [{ set_line: { anchor, new_text: target } }],
				});
				return {
					attempts,
					retries: attempts - 1,
					mismatches,
				};
			} catch (error) {
				if (error instanceof Error && /No changes made/.test(error.message)) {
					return {
						attempts,
						retries: attempts - 1,
						mismatches,
					};
				}
				if (!isHashlineMismatchError(error)) {
					throw error;
				}
				mismatches += 1;
			}
		}

		throw new Error(`worker ${workerId} exceeded retry budget after ${attempts} attempts`);
	}

	const metrics = await Promise.all(Array.from({ length: workers }, (_, i) => setWithRetry(i)));
	const totalRetries = metrics.reduce((sum, metric) => sum + metric.retries, 0);
	const totalMismatches = metrics.reduce((sum, metric) => sum + metric.mismatches, 0);
	return {
		finalContent: readFileSync(path, "utf8"),
		totalRetries,
		totalMismatches,
		metrics,
	};
}

describe("hashline concurrency stress validation", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			if (existsSync(dir)) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	test("handles concurrent stale anchors with retries and converges deterministically", async () => {
		const dir = mkdtempSync(join(tmpdir(), "pi-hashline-stress-"));
		tempDirs.push(dir);
		const path = join(dir, "shared.txt");
		writeFileSync(path, "seed\n");

		const editTool = createEditTool(dir, { editMode: "hashline" });
		const workers = 20;
		const wrongHash = computeLineHash(1, "seed") === "000000" ? "000001" : "000000";
		await expect(
			editTool.execute("explicit-mismatch", {
				path,
				edits: [{ set_line: { anchor: `1:${wrongHash}`, new_text: "nope" } }],
			}),
		).rejects.toThrow(/Hash mismatch/);
		const result = await runHashlineStressScenario(path, workers, 15, "shared-final");

		expect(result.finalContent).toBe("shared-final\n");
		expect(result.totalRetries).toBeGreaterThan(0);
		expect(result.totalMismatches).toBeGreaterThan(0);
		expect(result.metrics.every((metric) => metric.attempts <= 15)).toBe(true);
	});

	test("converges deterministically across stress matrix sizes", async () => {
		const matrix = [
			{ workers: 8, maxAttempts: 8, target: "matrix-a" },
			{ workers: 16, maxAttempts: 12, target: "matrix-b" },
			{ workers: 24, maxAttempts: 18, target: "matrix-c" },
		] as const;

		for (const scenario of matrix) {
			const dir = mkdtempSync(join(tmpdir(), "pi-hashline-matrix-"));
			tempDirs.push(dir);
			const path = join(dir, "shared.txt");
			writeFileSync(path, "seed\n");

			const result = await runHashlineStressScenario(path, scenario.workers, scenario.maxAttempts, scenario.target);

			const lines = result.finalContent
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0);
			expect(lines.length).toBeGreaterThan(0);
			expect(lines.every((line) => line === scenario.target)).toBe(true);
			expect(result.totalRetries).toBeGreaterThan(0);
			expect(result.totalMismatches).toBeGreaterThan(0);
			expect(result.metrics.every((metric) => metric.attempts <= scenario.maxAttempts)).toBe(true);
		}
	});
});
