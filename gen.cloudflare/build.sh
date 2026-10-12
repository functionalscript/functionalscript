#!/bin/sh
set -e
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain 1.99.0 --no-modify-path
export PATH="$HOME/.cargo/bin:$PATH"
npm run rustdoc-bars
RUSTDOCFLAGS="--html-before-content $PWD/_rustdoc-header.html --html-after-content $PWD/_rustdoc-footer.html --extend-css $PWD/_rustdoc.css" cargo doc --no-deps --workspace
npm run website
