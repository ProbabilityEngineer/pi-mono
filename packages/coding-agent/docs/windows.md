# Windows Setup

Pi requires a bash shell on Windows. Checked locations (in order):

1. Custom path from `~/.pi/agent/settings.json`
2. Git Bash (`C:\Program Files\Git\bin\bash.exe`)
3. `bash.exe` on PATH (Cygwin, MSYS2, WSL)

For most users, [Git for Windows](https://git-scm.com/download/win) is sufficient.

## Custom Shell Path

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

## LSP Troubleshooting

Pi validates Windows language-server commands by resolving `PATH` + `PATHEXT` and running a short probe (`<server> --version`).

If a language server keeps showing as missing or install attempts fail, check:

1. The command resolves to an executable wrapper:
   - `where <server-command>`
2. Executable suffixes include your wrapper type:
   - `echo %PATHEXT%`
   - Typical values include `.COM;.EXE;.BAT;.CMD`
3. The wrapper is runnable from your project shell:
   - `<server-command> --version`

Common failure/remediation cases:

- `ENOENT`: command not found. Reinstall and ensure install location is on `PATH`.
- `EACCES`: command exists but is not runnable. Fix file permissions/policy and retry.
- Probe timeout: command launch is slow/hung. Pi treats timeouts as available to avoid false negatives, but you should run the command manually to confirm it starts cleanly.
