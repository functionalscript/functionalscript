#!/bin/sh
set -e
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain 1.99.0 --no-modify-path
PATH="$HOME/.cargo/bin:$PATH" npm run website
