#!/bin/sh
set -e
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain 1.99.1 --no-modify-path
export PATH="$HOME/.cargo/bin:$PATH"
rustup target add wasm32-unknown-unknown
cargo build -p nanvm-demos --release --target wasm32-unknown-unknown
cargo run -p nanvm-demos-publish --release -- target/wasm32-unknown-unknown/release/nanvm_demos.wasm nanvm/demos/_build/nanvm_demos.wasm nanvm/demos/_build/nanvm_demos.wat
npm run rustdoc-bars
RUSTDOCFLAGS="--html-in-header $PWD/_rustdoc-head.html --html-before-content $PWD/_rustdoc-header.html --html-after-content $PWD/_rustdoc-footer.html --extend-css $PWD/_rustdoc.css" cargo doc --no-deps --workspace
npm run website
