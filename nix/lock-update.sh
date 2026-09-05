#!/bin/sh
set -e
nix flake lock --extra-experimental-features 'nix-command flakes' ./nix/node22
nix flake lock --extra-experimental-features 'nix-command flakes' ./nix/node24
nix flake lock --extra-experimental-features 'nix-command flakes' ./nix
