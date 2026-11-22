# `fjsrs`

A FunctionalScript program compiled to Rust and run as a native executable,
with no JavaScript host: the first step of the
[console program](../lib/todo/console-program.md).

```sh
cargo run -p nanvm-fjsrs -- help
```

## What it is made of

| Part | What it is |
| --- | --- |
| [`src/gen.program.native.rs`](./src/gen.program.native.rs) | The program, [`fjs/nanvm/fjsrs/module.f.js`](../../fjs/nanvm/fjsrs/module.f.js), compiled by `fjs compile` to Rust. `npm run gen` writes it; CI fails on a stale copy. |
| [`nanvm-lib`](../lib/) | The VM the program's values live in. |
| [`nanvm-effects-node`](../effects-node/) | The loop and the host that perform the effects the program answers. |
| [`src/lib.rs`](./src/lib.rs) | `run`: evaluates a compiled module, starts its `main` with the process's arguments, environment and home, performs the effect, and answers the exit code. |
| [`src/main.rs`](./src/main.rs) | The process around `run`. |

The program is the same source on every host. The Node `fjs` and this
executable differ in what performs the effects, not in what asks for them.

## What it does today

The program is the `fjs` command dispatch over the commands that run
natively, and none does yet, so it answers `help` and refuses everything
else, with the text and exit codes `fjs` gives for the same table.

The whole compiler, `fjs/module.f.js`, does build this way and answers
correctly. It is not the program here because it takes minutes to start:
[todo](./todo/whole-compiler.md).

## The name

`fjs` compiled to Rust. The suffix names the output of the compiler the
executable is built from; another target would be another executable beside
this one. The name a published crate's binary takes is an
[open question](../lib/todo/mvp-roadmap.md#open-questions) this does not
decide.


The `.native.rs` compiler output takes its concrete VM from the enclosing
Rust module. The executable chooses `Vm = Naive` once and includes the
generated application with `use super::Vm as A;`. The common runtime is
instantiated for that VM through `exports`. String values in the generated
application borrow named UTF-16 descriptors, one per distinct literal.
Ordinary `.rs` output continues to expose a generic module function.
