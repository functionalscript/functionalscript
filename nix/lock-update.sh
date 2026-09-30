#!/bin/sh
set -e
rm -f ./nix/node22/flake.lock
nix flake lock --extra-experimental-features 'nix-command flakes' ./nix/node22
rm -f ./nix/node24/flake.lock
nix flake lock --extra-experimental-features 'nix-command flakes' ./nix/node24
rm -f ./nix/flake.lock
nix flake lock --extra-experimental-features 'nix-command flakes' ./nix
