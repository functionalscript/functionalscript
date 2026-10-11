#!/bin/sh
set -e
curl --proto '=https' --tlsv1.2 -sSf https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init -o "$HOME/rustup-init"
chmod +x "$HOME/rustup-init"
"$HOME/rustup-init" -y --profile minimal --default-toolchain 1.99.0 --no-modify-path
"$HOME/.cargo/bin/cargo" doc --no-deps --workspace
npm run website
