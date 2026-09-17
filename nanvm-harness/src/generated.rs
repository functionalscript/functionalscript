//! Each submodule is `fjs compile fixtures/<name>.mjs <output>.rs`'s real
//! output for that fixture (see `build.rs`), spliced in verbatim via
//! `include!` — not hand-written, and not read from a path this crate
//! commits: `$OUT_DIR` is a Cargo-managed build-time directory, written by
//! `build.rs` whenever it reruns (a fresh checkout, or any change under a
//! path named in its `cargo:rerun-if-changed` — the fixtures themselves, or
//! anything under `fjs/`) and otherwise left as Cargo's incremental cache
//! found it. Each module exposes exactly the shape `mvp-roadmap.md`'s Rust
//! code generator section specifies: `pub fn module<A: IVm>() -> Any<A>`.

pub mod number {
    include!(concat!(env!("OUT_DIR"), "/number.rs"));
}

pub mod string {
    include!(concat!(env!("OUT_DIR"), "/string.rs"));
}

pub mod boolean {
    include!(concat!(env!("OUT_DIR"), "/boolean.rs"));
}
