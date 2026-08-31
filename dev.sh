#!/bin/sh
exec nix develop --extra-experimental-features nix-command --extra-experimental-features flakes ./nix
