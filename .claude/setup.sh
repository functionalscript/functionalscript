#!/bin/sh
# Setup script for a Claude Code cloud environment; see doc/mise-trial/README.md.
# Runs once per new session, before .claude/hooks/session-start.sh, from the
# repository root: `cd functionalscript && sh .claude/setup.sh`.
set -eu
# Host prerequisite for the i686-unknown-linux-gnu Rust target on Linux x64.
apt-get update -qq
apt-get install -y -qq gcc-multilib libc6-dev-i386
MISE_INSTALL_PATH=/usr/local/bin/mise sh -c "$(curl -fsSL https://mise.run)"
mise trust
mise install --locked
mise exec -- npm ci
