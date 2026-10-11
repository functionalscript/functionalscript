#!/bin/sh
set -e
nix flake lock --extra-experimental-features 'nix-command flakes' ./gen.nix
