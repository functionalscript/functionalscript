#!/bin/sh
# Claude Code SessionStart hook. Each of a cloud session's commands is a fresh
# process, so a shell `nix develop` opened for one of them is gone for the
# next. The hook therefore runs `npm ci` in the shell, then writes the shell's
# `PATH` into the session's environment file, which every later command
# inherits: `tsc`, `cargo` and the rest resolve to the shell's tools with no
# `./dev.sh` prefix. What the shellHook sets beyond `PATH` — the 32-bit linker
# on x86_64 Linux — still needs `./dev.sh`.
# `.claude/settings.json` runs it when a session starts or resumes, since a
# resumed session is a new process that needs the export again, and not on
# compaction or `/clear`, which keep the process and its environment.
# The first entry on a fresh container downloads the whole shell; the container
# is cached afterwards, so later sessions take seconds.
set -e
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
sh ./dev.sh npm ci
sh ./dev.sh sh -c 'echo "export PATH=\"$PATH\"" >> "$CLAUDE_ENV_FILE"'
