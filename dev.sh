#!/bin/sh
# The repository's development shell. No arguments opens it; arguments run one
# command in it: `./dev.sh npm test`. CI steps run the generated `gen.nix/run`.
# The flake is found next to this script, so the script works from any
# directory and the command runs where it was called. `nix` is taken from
# `PATH`, or from the default profile every installer writes when a shell has
# not sourced it — a Codex task after its setup script, say.
flake="$(dirname "$0")/gen.nix"
nix="$(command -v nix || echo /nix/var/nix/profiles/default/bin/nix)"
if [ $# -eq 0 ]; then
    exec "$nix" develop --extra-experimental-features 'nix-command flakes' --option bash-prompt-prefix 'FJS:' "$flake"
fi
exec "$nix" develop --extra-experimental-features 'nix-command flakes' --no-update-lock-file --quiet "$flake" --command "$@"
