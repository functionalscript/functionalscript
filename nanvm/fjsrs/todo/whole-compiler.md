## Run the whole compiler natively

**Priority:** P2
**Status:** open

### Problem

[`fjsrs`](../README.md) runs a program with no commands. The program it is
for is `fjs` itself, [`fjs/module.f.js`](../../../fjs/module.f.js). That one
builds and answers correctly, and is unusable.

Measured at `99252a6`, the compiler written by
`fjs compile fjs/module.f.js compiled.rs`, on a 4-core x64 Linux host with
Rust 1.100.0 and the reference VM (`Naive`), the generated module in a
crate of its own with a `main` like this crate's:

| Step | Result |
| --- | --- |
| The generated module | 8,473,838 bytes, 35,892 lines, one function |
| `cargo check` | passes with no warning, 3 min 56 s, 4.9 GB |
| `cargo build`, default `dev` profile | `rustc` overflows its stack in LLVM, writing debug information for the function's nested scopes |
| `cargo build`, `debug = false` | 4 min 35 s, a 68 MB executable |
| `cargo build --release` | not finished after two hours |
| `fjsrs` with no command | the right text and exit code, after 5 min 35 s |
| `fjsrs c ex.f.js out.json` | the bytes `fjs` writes on Node, after 7 min 58 s |
| The same on Node | under 2 s |

Compiling `nanvm-lib` and `nanvm-effects-node` at `opt-level = 3` under the
unoptimized module changed none of the run times.

The time is start-up. A program of 560 KB of generated Rust, one that logs
its arguments and imports the whole effects module, starts in 0.03 s. The
compiler is fifteen times the Rust and about ten thousand times the start.

### What is not known

Where the start-up goes. Every top-level definition of the compiler is
evaluated when its module is, so the candidates are a few definitions that
compute a great deal, a grammar or a table that a JIT makes cheap, and a
cost every definition pays in unoptimized generated code. No profile has
been taken.

### Proposal

- Profile the start. If a few definitions hold it, they are a change in
  FunctionalScript, and every host gains.
- Write a module as more than one Rust function. One function of 8 MB is
  what `rustc` cannot write debug information for and cannot optimize in
  any time worth waiting; smaller ones would also let a change rebuild part
  of the program. This is a change to the Rust output of `fjs compile`
  ([`fjs/compiler/rust`](../../../fjs/compiler/rust/module.f.js)).
- Let the generator own the lints its shapes trip. It allows
  `clippy::if_same_then_else` on what it writes; a program with loops also
  trips `never_loop` and `collapsible_if`, which this crate allows on its
  generated module by hand.

### Tasks

- [ ] Profile the compiler's start-up on the reference VM.
- [ ] Decide how a module is split into functions.
- [ ] Move `compile` into [`fjs/nanvm/fjsrs`](../../../fjs/nanvm/fjsrs/module.f.js)
      once it starts in a time a person waits for.
- [ ] Supply `packageRoot`: the compiler reads its runtime module through
      it for a data output, and a native executable has no package
      directory to name.

### Related

- [console-program](../../lib/todo/console-program.md) and the
  [MVP roadmap](../../lib/todo/mvp-roadmap.md), which this is a step of.
- [Node effects](../../../todo/nanvm-effects-node-operations.md): what a
  native program can ask for.
