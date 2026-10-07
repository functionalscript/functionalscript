#!/bin/sh
# Claude Code SessionStart hook: a cloud session begins inside a ready shell.
# The first entry on a fresh container downloads the whole shell; the container
# is cached afterwards, so later sessions take seconds.
set -e
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
sh ./gen.nix/run npm ci
