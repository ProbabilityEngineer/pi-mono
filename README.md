#MODS

 Summary: Changes Made to pi-mono                                                                                                                                                      
                                                                                                                                                                                       
 This document outlines features implemented in your pi-mono fork for backport to oh-my-pi:                                                                                            
                                                                                                                                                                                       
 ### 1. Hashline Editing                                                                                                                                                               
                                                                                                                                                                                       
 - Content-addressable editing using SHA1 hashes (6 hex chars) per line                                                                                                                
 - Format: LINE#HASH|CONTENT (e.g., 12#a1b2c3|const x = 1;)                                                                                                                            
 - Edit operations: set_line, replace_lines, insert_after                                                                                                                              
 - Hash mismatch recovery: Searches ±8 line window, reports affected ranges for targeted re-read                                                                                       
 - Settings toggle: edit.mode = "replace" | "hashline"                                                                                                                                 
                                                                                                                                                                                       
 ### 2. LSP Integration                                                                                                                                                                
                                                                                                                                                                                       
 - Full LSP client with diagnostics, hover, references, rename, format, symbols                                                                                                        
 - Modules: client, api, config, installer, settings-state, encounter, planner, edits, render, probe, lspmux                                                                           
 - Per-server settings: Enable/disable, install state, auto-enable/install on encounter                                                                                                
 - Agent-guided installation: Detects language, suggests server, provides install command                                                                                              
 - TypeScript tuning: Custom rootMarkers, isLinter flag                                                                                                                                
 - Management tools: lspStatus(), lspReload(serverId)                                                                                                                                  
                                                                                                                                                                                       
 ### 3. ast-grep Support                                                                                                                                                               
                                                                                                                                                                                       
 - AST-based code search (faster than grep for structural queries)                                                                                                                     
 - Tool API: pattern, path, language, include/exclude globs, rule YAML                                                                                                                 
 - First-class built-in tool with auto-install detection                                                                                                                               
                                                                                                                                                                                       
 ### 4. Hooks System (Gastown)                                                                                                                                                         
                                                                                                                                                                                       
 - Hook events: SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact                                                                                                  
 - Config sources (precedence): CLI config, project config, Claude settings, Gastown defaults                                                                                          
 - Features: Timeout control, output truncation, invocation logging, sensitive value redaction                                                                                         
 - Settings toggle: gastownMode (default: true)                                                                                                                                        
                                                                                                                                                                                       
 ### 5. Capability Policy Externalization                                                                                                                                              
                                                                                                                                                                                       
 - Skill-based policies moved from hardcoded to external templates                                                                                                                     
 - Two tiers: Core-only (minimal) vs Detailed (full playbook)                                                                                                                          
 - Auto-injection: Detects LSP/ast-grep availability, injects appropriate policy                                                                                                       
 - Tool selection guidance: LSP vs ast-grep vs grep based on availability                                                                                                              
 - Multiple refinements: Discovery-first lookup, bounded completeness, lexical backstop requirements                                                                                   
                                                                                                                                                                                       
 ### 6. Settings & Runtime                                                                                                                                                             
                                                                                                                                                                                       
 - Edit mode toggle: edit.mode = "replace" | "hashline"                                                                                                                                
 - LSP settings: enabled, autoEnable, autoInstall, per-language toggles, per-server controls                                                                                           
 - ast-grep settings: enabled toggle                                                                                                                                                   
 - Live runtime rebuild: Settings changes trigger LSP reinit, tool capability refresh                                                                                                  
                                                                                                                                                                                       
 ### 7. Model Management                                                                                                                                                               
                                                                                                                                                                                       
 - Provider grouping: Models grouped by provider in /model selector                                                                                                                    
 - Free-only filter: defaultModelFreeOnly setting or /freemodel command                                                                                                                
                                                                                                                                                                                       
 ### 8. Additional Features                                                                                                                                                            
                                                                                                                                                                                       
 - Slash command help: /help displays all available commands                                                                                                                           
 - Bundled prompt templates: Load by default with external customization support                                                                                                       
                                                                                                                                                                                       
 ### 9. Current WIP: Smart Partial Re-read                                                                                                                                             
                                                                                                                                                                                       
 - Commit: 728e30db (in progress)                                                                                                                                                      
 - Goal: On hash mismatch, only re-read affected line ranges instead of entire file                                                                                                    
 - Implemented: affectedLineRanges in edit details, ranges param in read tool, mergeRanges() utility                                                                                   
 - Missing: Automatic flow to trigger re-read after hash mismatch (3 options: agent-level automation, extension hook, capability policy integration)                                   
 - Pending: Handle whitespace lines with repeating hashes

Testing and Issues welcome!


# 🏖️ OSS Vacation

**Issue tracker and PRs reopen February 23, 2026.**

All PRs will be auto-closed until then. Approved contributors can submit PRs after vacation without reapproval. For support, join [Discord](https://discord.com/invite/3cU7Bz4UPx).

---

<p align="center">
  <a href="https://shittycodingagent.ai">
    <img src="https://shittycodingagent.ai/logo.svg" alt="pi logo" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://github.com/badlogic/pi-mono/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/badlogic/pi-mono/ci.yml?style=flat-square&branch=main" /></a>
</p>
<p align="center">
  <a href="https://pi.dev">pi.dev</a> domain graciously donated by
  <br /><br />
  <a href="https://exe.dev"><img src="packages/coding-agent/docs/images/exy.png" alt="Exy mascot" width="48" /><br />exe.dev</a>
</p>

# Pi Monorepo

> **Looking for the pi coding agent?** See **[packages/coding-agent](packages/coding-agent)** for installation and usage.

Tools for building AI agents and managing LLM deployments.

## Packages

| Package | Description |
|---------|-------------|
| **[@mariozechner/pi-ai](packages/ai)** | Unified multi-provider LLM API (OpenAI, Anthropic, Google, etc.) |
| **[@mariozechner/pi-agent-core](packages/agent)** | Agent runtime with tool calling and state management |
| **[@mariozechner/pi-coding-agent](packages/coding-agent)** | Interactive coding agent CLI |
| **[@mariozechner/pi-mom](packages/mom)** | Slack bot that delegates messages to the pi coding agent |
| **[@mariozechner/pi-tui](packages/tui)** | Terminal UI library with differential rendering |
| **[@mariozechner/pi-web-ui](packages/web-ui)** | Web components for AI chat interfaces |
| **[@mariozechner/pi-pods](packages/pods)** | CLI for managing vLLM deployments on GPU pods |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [AGENTS.md](AGENTS.md) for project-specific rules (for both humans and agents).

## Development

```bash
npm install          # Install all dependencies
npm run build        # Build all packages
npm run check        # Lint, format, and type check
./test.sh            # Run tests (skips LLM-dependent tests without API keys)
./pi-test.sh         # Run pi from sources (must be run from repo root)
```

> **Note:** `npm run check` requires `npm run build` to be run first. The web-ui package uses `tsc` which needs compiled `.d.ts` files from dependencies.

## License

MIT
