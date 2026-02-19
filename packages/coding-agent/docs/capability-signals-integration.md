# Capability Signals Integration Plan

This document defines where capability signals should be emitted in startup/runtime flow.

## Emission points
- Normal startup:
  - one concise line summary only.
- Verbose startup:
  - structured JSON payload (full capability signal shape).
- Reload/reconfiguration events:
  - re-emit structured payload only when capability state changed.

## Normal startup format

Example:

```text
Capabilities: lsp=on (auto-enable/install on), ast-grep=off
```

## Verbose startup format

Example:

```json
{
  "type": "capabilities",
  "capabilities": {
    "lsp": {
      "enabled": true,
      "autoEnableOnEncounter": true,
      "autoInstallOnEncounter": true
    },
    "astGrep": {
      "available": false
    }
  }
}
```

## Logging/noise constraints
- Normal mode should not emit warning spam for unavailable optional tools.
- Verbose mode may include explanatory metadata for unavailable tools.
- Emission should be stable to keep tests deterministic.

## Test expectations
- Normal mode snapshot test for concise capability line.
- Verbose mode snapshot test for structured payload field ordering.
- Regression test: missing `ast-grep` does not block startup.
