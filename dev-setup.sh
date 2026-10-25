#!/bin/sh
# Initialize the same Node/compiler profile as CI and the supported Rust toolchain.
set -eu
pixi install --locked --environment ci
pixi run --locked --environment ci npm install --prefix .pixi/ci-tools/npm typescript@7.0.2 bun@1.4.4 deno@2.8.3
rustup toolchain install 1.99.1 --profile minimal --component clippy,rustfmt
rustup override set 1.99.1
case "$(uname -s):$(uname -m)" in
  Linux:x86_64) rustup target add --toolchain 1.99.1 i686-unknown-linux-gnu ;;
  MINGW*:x86_64|MSYS*:x86_64) rustup target add --toolchain 1.99.1 i686-pc-windows-msvc ;;
esac
case "$(uname -s)" in
  Linux|Darwin) rustup target add --toolchain 1.99.1 wasm32-wasip1 wasm32-wasip2 wasm32-unknown-unknown wasm32-wasip1-threads ;;
esac
pixi run --locked --environment ci npm ci
