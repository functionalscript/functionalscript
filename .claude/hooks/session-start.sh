#!/bin/sh
# Restore the selected development environment for each cloud session.
set -eu
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
mise trust
mise install --locked
sh ./dev.sh npm ci
mise env --shell bash >> "$CLAUDE_ENV_FILE"
