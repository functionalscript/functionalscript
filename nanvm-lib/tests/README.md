# Tests

Operator behaviour is **not** written here. It is described once, as data, in
[`fjs/nanvm`](../../fjs/nanvm/README.md), and arrives in this crate as
[`test/generated.rs`](test/generated.rs) — so a case is written once and checked
twice, against a JavaScript engine and against `nanvm-lib`.

| File | Role |
|---|---|
| [`test/main.rs`](test/main.rs) | Hand-written tests with no JavaScript counterpart. |
| [`test/harness.rs`](test/harness.rs) | Value constructors and assertions the generated file calls. |
| [`test/generated.rs`](test/generated.rs) | **Generated. Do not edit.** One statement per case. |

`test/main.rs` rather than `test.rs`: cargo makes every `tests/*.rs` its own
test target, so the generated file and the harness have to live in a
subdirectory to stay ordinary submodules, and a subdirectory's entry point is
`main.rs`.

## Changing what is tested

An operator case belongs in [`fjs/nanvm/module.f.mjs`](../../fjs/nanvm/module.f.mjs);
`npm run ci-update` regenerates `test/generated.rs` from it, and CI fails if the
committed copy is stale.

What stays here is everything with no JavaScript counterpart: `try_into` out of
`Any`, `Debug` formatting, multi-limb bigint arithmetic, serialization
round-trips, and the exact text of `nanvm-lib`'s own error messages. These are
properties of the VM, not of JavaScript, so there is nothing to share.
