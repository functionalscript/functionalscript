#!/bin/sh
set -e
nix flake lock --extra-experimental-features 'nix-command flakes' ./gen.nix/node22
nix flake lock --extra-experimental-features 'nix-command flakes' ./gen.nix/node24
nix flake lock --extra-experimental-features 'nix-command flakes' ./gen.nix
