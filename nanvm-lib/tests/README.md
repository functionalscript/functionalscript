# Tests

Operator and member-function behaviour is **not** written here. It is described once, as data, in
[`fjs/nanvm`](../../fjs/nanvm/README.md), and arrives in this crate as
[`test/gen.corpus/`](test/gen.corpus/mod.rs) — so a case is written once and checked
twice, against a JavaScript engine and against `nanvm-lib`.

| File | Role |
|---|---|
| [`test/main.rs`](test/main.rs) | Hand-written tests with no JavaScript counterpart. |
| [`test/harness.rs`](test/harness.rs) | Assertions and the one value constructor the generated file calls that no literal spells; literals and `===`/`!==` come from `nanvm_lib::vm::unstable`. |
| [`test/gen.corpus/`](test/gen.corpus/mod.rs) | **Generated. Do not edit.** One file per group, one statement per case, and a `mod.rs` that runs them all. |

`test/main.rs` rather than `test.rs`: cargo makes every `tests/*.rs` its own
test target, so the generated file and the harness have to live in a
subdirectory to stay ordinary submodules, and a subdirectory's entry point is
`main.rs`. The generated directory's own entry point is its `mod.rs`, which
`main.rs` includes by `#[path]`, a `gen.` name being no Rust identifier.

## Changing what is tested

An operator case belongs in [`fjs/nanvm/module.f.mjs`](../../fjs/nanvm/module.f.mjs);
`npm run gen` regenerates `test/gen.corpus/` from it, and CI fails if the
committed copy is stale.

What stays here is everything with no JavaScript counterpart: `try_into` out of
`Any`, `Debug` formatting, multi-limb bigint arithmetic, and the exact text of
`nanvm-lib`'s own error messages. These are properties of the VM, not of
JavaScript, so there is nothing to share.
