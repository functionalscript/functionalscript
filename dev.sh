#!/bin/sh
exec nix develop --extra-experimental-features nix-command --extra-experimental-features flakes --option bash-prompt-prefix nix: ./nix
