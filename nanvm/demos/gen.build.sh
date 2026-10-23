#!/bin/sh
set -e
case "$(rustc --version)" in
"rustc 1.99.1 "*) ;;
*) echo "nanvm/demos/wasm/ is built with Rust 1.99.1, not $(rustc --version): run sh ./gen.nix/run sh ./nanvm/demos/gen.build.sh" >&2; exit 1 ;;
esac
cargo build -p nanvm-demos --release --target wasm32-unknown-unknown
cargo run -p nanvm-demos-publish --release -- target/wasm32-unknown-unknown/release/nanvm_demos.wasm nanvm/demos/wasm/nanvm_demos.wasm nanvm/demos/wasm hello sort collatz comma constants variables destructuring member_functions static_functions guards loops switch_statement number_conversion string_conversion functions call_statements calls captures function_outputs names_and_identity parameters comments identifiers string_escapes whitespace exports operators grouping instanceof property_access entries optional_chaining values arrays bigints numbers objects strings template_literals
