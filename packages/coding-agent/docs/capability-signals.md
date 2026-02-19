# Capability Signals

Capability signals describe which tooling paths are currently available so models can choose the right tool without trial-and-error.

## Goals
- Keep startup/runtime signaling concise and deterministic.
- Avoid attempts to call unavailable tools.
- Separate semantic capability state (LSP) from structural capability state (`ast-grep`).

## Canonical signal shape

```json
{
  "capabilities": {
    "lsp": {
      "enabled": true,
      "autoEnableOnEncounter": true,
      "autoInstallOnEncounter": true,
      "languages": {
        "typescript": {
          "enabled": true,
          "serverInstalled": true,
          "autoInstallable": true
        },
        "rust": {
          "enabled": false,
          "serverInstalled": false,
          "autoInstallable": true
        }
      }
    },
    "astGrep": {
      "available": false
    }
  }
}
```

## Field semantics
- `lsp.enabled`: master LSP toggle.
- `lsp.autoEnableOnEncounter`: whether first language encounter can enable that language.
- `lsp.autoInstallOnEncounter`: whether missing server install can run automatically on encounter.
- `languages.<id>.enabled`: language-level opt-in state.
- `languages.<id>.serverInstalled`: known local server installation state.
- `languages.<id>.autoInstallable`: supported install path exists for this language.
- `astGrep.available`: executable resolved on current PATH.

## Determinism rules
- Emit fields in stable order:
  1. `capabilities.lsp`
  2. `capabilities.astGrep`
- Emit `lsp` fields in order:
  1. `enabled`
  2. `autoEnableOnEncounter`
  3. `autoInstallOnEncounter`
  4. `languages`
- Emit `languages` keys sorted ascending by language id.
- Omit nullable/unknown fields instead of emitting random placeholders.

## Prompt-use guidance coupling
- If `astGrep.available` is `false`, prompt guidance MUST NOT direct `ast-grep` usage.
- If LSP is disabled, prompt guidance SHOULD avoid semantic-tool suggestions and fall back to standard file/tool workflows.

## Validation checklist
- Signal payload is deterministic across repeated startups with unchanged environment.
- Missing `ast-grep` shows `available=false` without warnings in normal mode.
- Per-language status is accurate after encounter automation runs.
