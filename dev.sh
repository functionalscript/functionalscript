#!/bin/sh
# The repository's development shell. No arguments opens it; arguments run one
# command in it: `./dev.sh npm test`. CI steps run the generated `gen.nix/run`.
if [ $# -eq 0 ]; then
    exec nix develop --extra-experimental-features 'nix-command flakes' --option bash-prompt-prefix 'FJS:' ./gen.nix
fi
exec nix develop --extra-experimental-features 'nix-command flakes' --no-update-lock-file --quiet ./gen.nix --command "$@"
