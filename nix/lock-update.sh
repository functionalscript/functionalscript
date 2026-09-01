#!/bin/sh
set -e
nix flake lock ./nix/node22
nix flake lock ./nix/node24
nix flake lock ./nix/ubuntu-intel32
nix flake lock ./nix
