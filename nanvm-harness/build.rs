//! Compiles [`fixtures`] with the real `fjs compile <input> <output>.rs`
//! (`fjs/fsc/rust/module.f.mjs`) at build time, one output per fixture, into
//! `$OUT_DIR`; `src/generated.rs` `include!`s them.
//!
//! This is the literal walking-skeleton pipeline
//! (`todo/fjs-nanvm-integration.md`), run on every build instead of against
//! hand-written stand-ins: `cargo build`/`cargo test` on this crate now
//! genuinely exercises `fjs compile`'s output, not a duplicate of it. Unlike
//! `nanvm-lib`, which deliberately carries no build script so it builds with
//! cargo alone for crates.io/docs.rs (see `nanvm-lib/todo/mvp-roadmap.md`'s
//! Distribution section), `nanvm-harness` is monorepo test infrastructure,
//! never published, so depending on a `node` binary being on `PATH` here —
//! the same assumption this repository's own `npm run gen` already makes —
//! costs nothing a published crate would need to avoid.

use std::{path::Path, process::Command};

const FIXTURES: [&str; 3] = ["number", "string", "boolean"];

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("set by cargo");
    let repo_root = Path::new(&manifest_dir)
        .parent()
        .expect("nanvm-harness is a direct child of the workspace root");
    let compiler = repo_root.join("fjs").join("module.mjs");
    let out_dir = std::env::var("OUT_DIR").expect("set by cargo");

    for name in FIXTURES {
        let input = Path::new(&manifest_dir)
            .join("fixtures")
            .join(format!("{name}.mjs"));
        let output = Path::new(&out_dir).join(format!("{name}.rs"));
        println!("cargo:rerun-if-changed={}", input.display());

        let status = Command::new("node")
            .arg(&compiler)
            .arg("compile")
            .arg(&input)
            .arg(&output)
            .status()
            .unwrap_or_else(|e| panic!("failed to run `node {}`: {e}", compiler.display()));
        assert!(
            status.success(),
            "`fjs compile {} {}` failed",
            input.display(),
            output.display()
        );
    }
}
