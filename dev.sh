#!/bin/sh
exec nix develop ./nix --extra-experimental-features nix-command --extra-experimental-features flakes --option bash-prompt-prefix FJS:
