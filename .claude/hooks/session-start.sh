#!/bin/sh
# Restore the selected development environment for each cloud session.
set -eu
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"
sh ./dev-setup.sh
pixi shell-hook --environment ci --shell bash >> "$CLAUDE_ENV_FILE"
