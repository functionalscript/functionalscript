//! Each submodule is `fjs compile fixtures/<name>.mjs <output>.rs`'s real
//! output for that fixture (see `build.rs`), spliced in verbatim via
//! `include!` — not hand-written, and not read from a path this crate
//! commits: `$OUT_DIR` is a fresh build-time scratch directory, regenerated
//! on every build. Each module exposes exactly the shape
//! `mvp-roadmap.md`'s Rust code generator section specifies:
//! `pub fn module<A: IVm>() -> Any<A>`.

pub mod number {
    include!(concat!(env!("OUT_DIR"), "/number.rs"));
}

pub mod string {
    include!(concat!(env!("OUT_DIR"), "/string.rs"));
}

pub mod boolean {
    include!(concat!(env!("OUT_DIR"), "/boolean.rs"));
}
