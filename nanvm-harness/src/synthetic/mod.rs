//! Hand-written stand-ins for `fjs compile <module> <output>.rs` output.
//!
//! **Not generated.** No tool produces these yet — the Rust code generator
//! is a separate, not-yet-started MVP task (the "Rust code generator" entry
//! in `nanvm-lib/todo/mvp-roadmap.md`). Each module below is shaped the way
//! that roadmap says a real generated module eventually will be — a
//! `pub fn module<A: IVm>() -> Any<A>`, not a `main` — so [`crate::run`] can
//! be proven end-to-end now, before codegen exists.
//!
//! To keep these from being mistaken for real generated output (which will
//! eventually be machine-generated, committed, and drift-checked in CI —
//! see `nanvm-lib/todo/mvp-roadmap.md`'s Distribution section): every file
//! here starts with a `NOT machine-generated` doc comment, and each has a
//! sibling `.f.mjs` file under `../../fixtures/` showing, purely as
//! documentation, the FunctionalScript source it stands in for. That
//! `.f.mjs` file is not read by any build step and carries no meaning for
//! the repository's separate `.f.mjs` -> `.f.js` compiler-compatibility
//! migration (`fjs/fsc/README.md`).
pub mod boolean;
pub mod number;
pub mod string;
