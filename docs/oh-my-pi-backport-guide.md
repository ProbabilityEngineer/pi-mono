# oh-my-pi Extension Guide: Features from pi-mono Fork

This document details features implemented in the pi-mono fork that can be backported to oh-my-pi as extensions or core modifications.

---

## Table of Contents

1. [Hashline Editing](#1-hashline-editing)
2. [LSP Integration](#2-lsp-integration)
3. [ast-grep Support](#3-ast-grep-support)
4. [Hooks System (Gastown)](#4-hooks-system-gastown)
5. [Capability Policy Externalization](#5-capability-policy-externalization)
6. [Settings & Runtime](#6-settings--runtime)
7. [Model Management](#7-model-management)
8. [Additional Features](#8-additional-features)
9. [Current WIP](#9-current-wip)

---

## 1. Hashline Editing

Hashline editing provides content-addressable file editing where each line is identified by a SHA1 hash, enabling robust concurrent editing.

### 1.1 Core Implementation

**Files:**
- `packages/coding-agent/src/core/tools/hashline.ts`

**Key Functions:**
```typescript
// Compute hash for a single line (SHA1, 6 hex chars)
computeLineHash(lineNum: number, line: string): string

// Format file content with hashlines (LINE#HASH|CONTENT)
formatHashLines(content: string, startLine?: number): string

// Parse line reference from string like "12#49c4e9"
parseLineRef(ref: string): HashlineRef

// Resolve line reference with hash mismatch recovery
resolveLineRef(ref: HashlineRef, fileLines: string[]): ResolvedLineRef
```

**Hashline Format:** `LINE#HASH|CONTENT`
- Example: `12#a1b2c3|const x = 1;`
- Hash: First 6 characters of SHA1 of normalized line content
- Compatible anchor format: minimum 2 characters (prefix matching)

### 1.2 Edit Operations

```typescript
type HashlineEditOperation =
  | { set_line: { anchor: string; new_text: string } }
  | { replace_lines: { start_anchor: string; end_anchor: string; new_text: string } }
  | { insert_after: { anchor: string; text: string } };
```

### 1.3 Hash Mismatch Recovery

When local hashlines diverge from remote:
1. Search within ±8 line window for hash match
2. If single match found, adjust anchor line number
3. If multiple matches, throw ambiguous error (requiring re-read)
4. If no nearby match, search entire file
5. Report affected range in error message for targeted re-read

### 1.4 Integration Points

- **Edit tool**: Parse hashline anchors, resolve to line numbers
- **Read tool**: Gate output with hashlines, add hashline prefix
- **Grep tool**: Support hashline-annotated output

### 1.5 Settings Toggle

In `settings-manager.ts`:
```typescript
interface EditSettings {
  mode?: "replace" | "hashline"; // default: "replace"
}
```

---

## 2. LSP Integration

Full Language Server Protocol integration for diagnostics, go-to-definition, references, rename, format, and symbol search.

### 2.1 Architecture

**Files:**
- `packages/coding-agent/src/lsp/` (main implementation)
- `packages/coding-agent/src/core/tools/lsp.ts` (tool integration)

**Modules:**
| Module | Purpose |
|--------|---------|
| `client.ts` | LSP client transport, message mux, lifecycle |
| `api.ts` | Tool-facing API (diagnostics, hover, refs, rename, symbols) |
| `config.ts` | Server discovery, command probing, detection |
| `installer.ts` | Server installation management |
| `settings-state.ts` | Per-server settings persistence |
| `encounter.ts` | Lazy encounter with language + install planning |
| `planner.ts` | Plan LSP enablement workflow |
| `edits.ts` | Apply workspace edits |
| `render.ts` | Format diagnostics and workspace edits for display |
| `probe.ts` | Command availability probing |
| `lspmux.ts` | LSP multiplexer support (lspmux) |

### 2.2 Tool API

```typescript
// Diagnostics with severity filtering
lspDiagnostics(input: {
  path: string;
  only?: DiagnosticSeverity[];
}): Promise<LspDiagnosticsResult>;

// Hover with language detection fallback
lspHover(input: {
  path: string;
  line: number;
  column: number;
}): Promise<LspHoverResult>;

// References with context
lspReferences(input: {
  path: string;
  line: number;
  column: number;
}): Promise<LspReferencesResult>;

// Rename with workspace edit application
lspRename(input: {
  path: string;
  line: number;
  column: number;
  newName: string;
}): Promise<LspRenameResult>;

// Document formatting
lspFormatDocument(input: {
  path: string;
}): Promise<LspFormatResult>;

// Workspace symbols
lspWorkspaceSymbols(input: {
  query: string;
}): Promise<LspWorkspaceSymbolsResult>;
```

### 2.3 Server Discovery

```typescript
// Probe for server availability
probeCommandInvocation(command: string): Promise<boolean>;

// Load servers from config files
loadLspServers(options: {
  cwd: string;
  configPaths?: string[];
}): Promise<LspConfigFile[]>;

// Get servers for language
getServersForLanguage(languageId: string): InstallerDefinition[];
```

### 2.4 Per-Server Settings

```typescript
interface LspServerSettings {
  enabled?: boolean;      // Per-server enable/disable
  installed?: boolean;    // Install state marker (for UI)
}

// Persisted in settings.json
interface Settings {
  lsp?: {
    enabled?: boolean;
    autoEnableOnEncounter?: boolean;
    autoInstallOnEncounter?: boolean;
    languages?: Record<string, boolean>;
    servers?: Record<string, LspServerSettings>;
  };
}
```

### 2.5 Agent-Guided Installation

When LSP server not found:
1. Detect language from file extension
2. Suggest appropriate server (e.g., `typescript-language-server` for TS/JS)
3. Provide install command
4. Offer "agent-guided" installation with follow-up planning

```typescript
buildAgentGuidedLspInstallPrompt(input: {
  language: string;
  serverName: string;
  installCommand: string;
}): string;
```

### 2.6 Lazy Encounter Flow

```typescript
// Coordinator for language encounters
createLanguageEncounterCoordinator(options: {
  cwd: string;
  filePath: string;
}): LanguageEncounterCoordinator;

// Plan next steps
planLanguageEncounter(input: {
  cwd: string;
  filePath: string;
}): Promise<PlanLanguageEncounterResult>;
```

### 2.7 TypeScript LSP Tuning (from oh-my-pi)

Enhanced TypeScript/JavaScript LSP configuration:

```typescript
interface LspServerDefinition {
  rootMarkers?: string[];    // e.g., ["tsconfig.json", "package.json"]
  isLinter?: boolean;         // Mark server as linter-only role
}
```

- `rootMarkers`: Custom project root markers beyond standard detection
- `isLinter`: Designate LSP server as linter-only
- Extended config discovery: YAML files + extra search paths

### 2.8 LSP Status and Reload Tools

Runtime LSP management tools:

```typescript
lspStatus(): Promise<LspServerStatus[]>    // List all servers and their state
lspReload(serverId: string): Promise<void> // Reload specific server
```

---

## 3. ast-grep Support

ast-grep is a AST-based code search tool, faster than grep for structural queries.

### 3.1 Architecture

**Files:**
- `packages/coding-agent/src/ast-grep/` (main implementation)
- `packages/coding-agent/src/core/tools/ast-grep.ts` (tool integration)

**Modules:**
| Module | Purpose |
|--------|---------|
| `installer.ts` | ast-grep binary installation |
| `settings-state.ts` | Install state management |
| `agent-guided-install.ts` | Guided installation prompts |
| `types.ts` | Type definitions |

### 3.2 Tool API

```typescript
interface AstGrepSearchInput {
  pattern: string;        // AST pattern or regex
  path?: string;          // File/directory to search
  language?: string;      // Language for AST parsing
  include?: string[];     // Glob patterns to include
  exclude?: string[];     // Glob patterns to exclude
  rule?: string;          // ast-grep rule YAML
}

interface AstGrepSearchResult {
  filePath: string;
  matches: {
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    message?: string;
    severity?: "error" | "warning" | "info";
  }[];
}
```

### 3.3 First-Class Built-in Tool

- Registered in default tool surface alongside grep
- Automatic installation detection
- Agent-guided install prompts
- Settings toggle in `/settings`

---

## 4. Hooks System (Gastown)

Implements Claude Code-like hooks for extending agent behavior.

### 4.1 Hook Events

```typescript
const HOOK_EVENT_NAMES = [
  "SessionStart",      // Before session starts
  "PreToolUse",       // Before tool execution
  "PostToolUse",      // After tool success
  "PostToolUseFailure",// After tool failure
  "PreCompact",       // Before message compaction
] as const;
```

### 4.2 Hook Configuration

```typescript
interface HookDefinition {
  command: string;              // Command to run
  timeoutMs?: number;          // Timeout (default: 30000)
  matcher?: {
    toolNames?: string[];      // Filter by tool name
  };
  failOpen?: boolean;          // Allow on hook failure
}

type HooksConfigMap = Partial<Record<HookEventName, HookDefinition[]>>;
```

### 4.3 Config Sources (Precedence)

1. **CLI config file** (`~/.config/pi/hooks.json`)
2. **Project config file** (`./.ai/hooks.json`)
3. **Claude settings** (optional, `~/.claude/settings.json`)
4. **Gastown defaults** (built-in when no higher precedence)

### 4.4 Hook Runner

```typescript
interface HookCommandPayload {
  hook_event_name: HookEventName;
  cwd: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  tool_error?: string;
}

interface HookCommandRunOptions {
  cwd: string;
  payload: HookCommandPayload;
  timeoutMs?: number;
  maxOutputBytes?: number;  // Truncation limit
  signal?: AbortSignal;
}

interface HookCommandRunResult {
  code: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  timedOut: boolean;
}
```

### 4.5 Invocation Logging

```typescript
interface HookInvocationRecord {
  eventName: HookEventName;
  command: string;
  configSourceName?: string;
  code: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  failed: boolean;
  decision?: "allow" | "deny" | "ask";
  reason?: string;
  redacted?: boolean;         // Sensitive values redacted
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  truncated?: boolean;
}
```

### 4.6 Redaction

Sensitive values in tool input are redacted:
- File paths (if containing secrets)
- API keys
- Environment variables marked as sensitive

### 4.7 Invalid Config Handling

- Detect invalid hook config at startup
- Surface warnings on startup
- Optionally disable hooks session-wide for invalid config

### 4.8 Gastown Mode

```typescript
// Settings toggle
interface Settings {
  gastownMode?: boolean;  // default: true
}
```

When enabled:
- Load built-in default hooks
- Use Claude settings hooks loader (optional)
- Integrate with pre/post tool hooks lifecycle

---

## 5. Capability Policy Externalization

Moves hardcoded behavior guidance from code to external skill/prompt templates.

### 5.1 Skill-Based Policies

```typescript
// Skill frontmatter
interface SkillFrontmatter {
  name?: string;
  description?: string;
  "disable-model-invocation"?: boolean;
}
```

### 5.2 Capability Policy Templates

Two tiers:
1. **Core-only** (minimal): Essential rules for tool usage
2. **Detailed** (optional): Full playbook with LSP/ast-grep guidance

### 5.3 Auto-Injection

- Detect LSP/ast-grep availability at runtime
- Inject appropriate policy into system prompt
- Availability-aware template selection

### 5.4 LSP vs ast-grep Guidance

Template logic:
```typescript
// Availability detection
capabilitySignals: {
  lsp?: {
    available: boolean;
    languages: string[];
  };
  astGrep?: {
    available: boolean;
  };
}

// Tool selection guidance
IF lsp.available AND astGrep.available:
  - Use ast-grep for pattern search
  - Use LSP for semantic analysis
ELSE IF lsp.available:
  - Use LSP for all code intelligence
ELSE IF astGrep.available:
  - Use ast-grep for structural search
ELSE:
  - Use grep for text search
```

### 5.5 Refinements

Various fixes and improvements:
- Stop immediately after exact symbol-location match
- Tighten semantic fallback to single canonical query
- Add LSP target-position sanity guard
- Stop on evidence-complete results and deduplicate repeated queries
- Progress-gate lookup controls
- Reduce extraction noise with retry and evidence guardrails
- Suppress status-first lookups and enforce concise evidence output
- Enforce discovery-first lookup and bounded completeness flow
- Prefer file-first LSP calls with optional status guidance
- Require lexical backstop for semantic reference coverage
- Use ast-grep run pattern flow with LSP-first guidance

---

## 6. Settings & Runtime

### 6.1 Edit Mode Toggle

```typescript
interface Settings {
  edit?: {
    mode?: "replace" | "hashline";  // default: "replace"
  };
}
```

### 6.2 LSP Settings

```typescript
interface Settings {
  lsp?: {
    enabled?: boolean;                    // default: true
    autoEnableOnEncounter?: boolean;      // default: true
    autoInstallOnEncounter?: boolean;     // default: true
    languages?: Record<string, boolean>; // Per-language toggle
    servers?: Record<string, LspServerSettings>;
  };
}
```

### 6.3 Live Runtime Rebuild

When settings change in `/settings`:
1. Update in-memory settings
2. Trigger LSP client reinitialization
3. Refresh server availability
4. Update tool capabilities

### 6.4 Per-Server Controls

- **Install state detection**: Probe runtime for installed servers
- **Settings persistence**: Store per-server enable/disable
- **Runtime filtering**: Apply settings to LSP requests
- **Uninstall flow**: Remove server from config
- **Runtime ignore**: Mark server as user-ignored

### 6.5 ast-grep Settings

```typescript
interface Settings {
  astGrep?: {
    enabled?: boolean;
  };
}
```

---

## 7. Model Management

### 7.1 Model Grouping

```typescript
interface Settings {
  defaultProvider?: string;
  defaultModel?: string;
}
```

- Models grouped by provider in `/model` selector
- Provider headers in model picker UI

### 7.2 Free-Only Filter

```typescript
interface Settings {
  // Option 1: Setting toggle
  defaultModelFreeOnly?: boolean;
  
  // Option 2: Command (alternative)
  // /freemodel - toggle free models only
}
```

### 7.3 /freemodel Command

Slash command to toggle free-only filter:
- Persists setting
- Filters model list in `/model` and `/settings`
- Works alongside provider grouping

---

## 8. Additional Features

### 8.1 Slash Command Help

Built-in `/help` command that displays all available slash commands and built-in command inventory.

### 8.2 Bundled Prompt Templates

Load bundled prompt templates by default, with support for external customization.

---

## 9. Current WIP

### Smart Partial Re-read on Hash Mismatch

**Commit:** `728e30db` (in progress)

When hashline anchors don't match due to concurrent edits, instead of failing, the system:

1. Computes affected line ranges (±8 line window around each mismatch)
2. Returns error with `affectedLineRanges` hint
3. Read tool accepts optional `ranges` parameter
4. Computes effective offset/limit from ranges for partial file read

```typescript
// hashline.ts - Error includes affected ranges
throw new Error(
  `Hash mismatch for line ${ref.line}. ` +
  `Expected ${ref.hash}, found ${actualHash}. ` +
  `Only lines ${affectedRange.startLine}-${affectedRange.endLine} need to be re-read.`
);

// read.ts - Accepts ranges for partial read
interface ReadInput {
  path: string;
  offset?: number;
  limit?: number;
  ranges?: AffectedLineRange[];  // For partial re-read
}
```

**Merge logic:**
```typescript
function mergeRanges(ranges: AffectedLineRange[]): AffectedLineRange[] {
  // Sort by start line, merge overlapping ranges
  // Returns minimal set of ranges to re-read
}
```

This enables collaborative editing where multiple agents can work on the same file without full re-reads on every conflict.
### Completion Plan

**Current State:**
- Data structures implemented: `affectedLineRanges` in edit details, `ranges` param in read tool
- Missing: Automatic flow to trigger re-read after hash mismatch

**What is Missing:**
When a hash mismatch occurs, the edit tool returns an error with `affectedLineRanges` hint, but there's no automatic mechanism to:
1. Detect the hash mismatch in the edit result
2. Automatically trigger a read with the affected ranges
3. Update the local hashlines in the agent's context

**Implementation Options:**

**Option A: Agent-Level Automation (Recommended)**
Modify the agent session to intercept edit tool results:

```typescript
// In agent-session.ts - after tool execution
if (toolName === "edit" && result.details?.affectedLineRanges) {
  // Auto-trigger re-read with affected ranges
  const ranges = result.details.affectedLineRanges;
  const reReadResult = await executeTool("read", {
    path: editPath,
    ranges: ranges
  });
  // Merge new hashlines into context
  updateContextWithNewHashlines(reReadResult);
}
```

**Option B: Extension Hook**
Add a hook that fires on tool result:

```typescript
// Extension handler for auto re-read
on("tool_result", async (event) => {
  if (event.toolName === "edit" && event.result.details?.affectedLineRanges) {
    return await invokeReadWithRanges(event.result.details.affectedLineRanges);
  }
});
```

**Option C: Capability Policy Integration**
Add guidance to the capability policy:

```yaml
# In capability policy skill
- IF edit returns hash mismatch error:
  - Extract affectedLineRanges from error message
  - Call read tool with ranges parameter
  - Retry edit with fresh hashlines
```

**Steps to Complete:**

1. **Add re-read trigger in agent-session.ts**
2. **Handle edge cases** (concurrent edits, partial failures)
3. **Add tests** (hash mismatch triggers auto re-read)


---

## Extension Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] Add settings types for hashline, LSP, ast-grep
- [ ] Create settings selector UI with toggles
- [ ] Implement settings persistence and hot-reload

### Phase 2: Hashline

- [ ] Implement `core/tools/hashline.ts`
- [ ] Integrate with edit tool
- [ ] Add hashline output to read tool
- [ ] Add compatibility layer (2-char minimum hash)

### Phase 3: LSP

- [ ] Create `lsp/` module
- [ ] Implement client transport and message handling
- [ ] Add server discovery (config files, PATH)
- [ ] Implement tool API (diagnostics, hover, refs, rename, format)
- [ ] Add server installation management
- [ ] Create agent-guided install prompts
- [ ] Add TypeScript LSP tuning (rootMarkers, isLinter)
- [ ] Add status and reload tools
- [ ] Expand config discovery to YAML

### Phase 4: ast-grep

- [ ] Create `ast-grep/` module
- [ ] Implement installation detection
- [ ] Create tool API
- [ ] Add to default tool surface
- [ ] Add settings toggle

### Phase 5: Hooks

- [ ] Define hook config schema
- [ ] Implement config source precedence
- [ ] Create hook runner with timeout/truncation
- [ ] Add invocation logging with redaction
- [ ] Implement invalid config detection
- [ ] Add Gastown mode toggle

### Phase 6: Capability Policy

- [ ] Externalize policy to skill templates
- [ ] Implement availability detection
- [ ] Add auto-injection logic
- [ ] Create core vs detailed template variants

### Phase 7: Additional Features

- [ ] Add slash command help
- [ ] Implement bundled prompt templates

---

## Key Files Reference

| Feature | Primary Files |
|---------|--------------|
| Hashline | `core/tools/hashline.ts`, `core/tools/edit.ts`, `core/tools/read.ts` |
| LSP | `lsp/*.ts`, `core/tools/lsp.ts` |
| ast-grep | `ast-grep/*.ts`, `core/tools/ast-grep.ts` |
| Hooks | `core/hooks/*.ts` |
| Settings | `core/settings-manager.ts` |
| Skills | `core/skills.ts`, `core/prompt-templates.ts` |

---

## Testing

Run tests from package root:
```bash
cd packages/coding-agent
npx vitest --run test/hashline.test.ts
npx vitest --run test/lsp.test.ts
npx vitest --run test/hooks.test.ts
```

---

## Related Documentation

- [pi-mono CHANGELOG](./packages/coding-agent/CHANGELOG.md)
- [Skills spec](./packages/coding-agent/docs/skills.md)
- [Prompt templates](./packages/coding-agent/docs/prompt-templates.md)
