export interface RedactionResult {
	value: string;
	redacted: boolean;
}

export interface TruncationResult {
	value: string;
	truncated: boolean;
}

export const HOOK_LOG_MAX_CHARS = 2000;
const LOG_TRUNCATION_SUFFIX = "\n...[truncated]";

const SECRET_PATTERNS: RegExp[] = [
	/\bsk-[A-Za-z0-9_-]{16,}\b/g,
	/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g,
	/\bAIza[0-9A-Za-z_-]{20,}\b/g,
	/\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
	/\b(Bearer\s+)[A-Za-z0-9._~-]{10,}\b/gi,
	/\b([A-Z0-9_]*(?:TOKEN|API_KEY|SECRET|PASSWORD)[A-Z0-9_]*\s*[=:]\s*)([^\s"']+)/gi,
];

export function redactSensitiveText(input: string): RedactionResult {
	let value = input;
	let redacted = false;

	value = value.replace(SECRET_PATTERNS[0], () => {
		redacted = true;
		return "[REDACTED]";
	});
	value = value.replace(SECRET_PATTERNS[1], () => {
		redacted = true;
		return "[REDACTED]";
	});
	value = value.replace(SECRET_PATTERNS[2], () => {
		redacted = true;
		return "[REDACTED]";
	});
	value = value.replace(SECRET_PATTERNS[3], () => {
		redacted = true;
		return "[REDACTED]";
	});
	value = value.replace(SECRET_PATTERNS[4], (_, prefix: string) => {
		redacted = true;
		return `${prefix}[REDACTED]`;
	});
	value = value.replace(SECRET_PATTERNS[5], (_, prefix: string) => {
		redacted = true;
		return `${prefix}[REDACTED]`;
	});

	return { value, redacted };
}

export function truncateHookLogText(input: string, maxChars: number = HOOK_LOG_MAX_CHARS): TruncationResult {
	if (input.length <= maxChars) {
		return { value: input, truncated: false };
	}
	return {
		value: `${input.slice(0, maxChars)}${LOG_TRUNCATION_SUFFIX}`,
		truncated: true,
	};
}
