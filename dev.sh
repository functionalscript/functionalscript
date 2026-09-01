#!/bin/sh
exec nix develop --extra-experimental-features 'nix-command flakes' --option bash-prompt-prefix 'FJS:' ./nix
