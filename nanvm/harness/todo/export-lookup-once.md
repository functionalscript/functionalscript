## The integration tests copy their export lookup

**Priority:** P4
**Status:** open

### Problem

Four of the FAST integration tests under [`tests/`](../tests),
`deferred_owning_tail_calls.rs`, `immutable_joins.rs`,
`independent_tail_recipes.rs` and `owning_self_tail_calls.rs`, open with
the same two helpers to the byte:

```rust
fn exports() -> Object<Naive> {
    nanvm_lib::vm::exports(deferred::module::<Naive>).unwrap()
}
fn function(exports: &Object<Naive>, name: &str) -> Function<Naive> {
    Function::try_from(exports.own_property(&name.into()).unwrap()).unwrap()
}
```

"The export `name` of `module`" is spelled again as `member` in
[`tests/common/mod.rs`](../tests/common/mod.rs), `export` in
`tests/effects.rs`, `exports_of` and `default_export` in
[`src/lib.rs`](../src/lib.rs)'s tests, `default_of` in
[`src/compare.rs`](../src/compare.rs), `load` in
[`nanvm/demos`](../../demos/src/lib.rs), and inside `run` in `src/lib.rs`
itself, which is the one place it has a home. The tests then repeat
`call.call(args).unwrap().to_json()` against `Ok(expected.into())` and
`Array::try_from(call.call(args).unwrap()).unwrap()` a few dozen times
between them at `d7bead6`.

### Proposal

`run`'s first half becomes `pub fn export<A: IVm>(module: Module<A>, name:
&str) -> Result<Any<A>, RunError<A>>`; `run`, `tests/effects.rs` and
`demos::load` call it. `tests/common/mod.rs`, the crate's shared test
module, gains `exports`, `function` and two result readers, `json` and
`array`, and the four tests replace their preambles with `mod common`.
`mixed_self_uses.rs` answers a function rather than an export object and
keeps its direct call, sharing `array` only.

### Tasks

- [ ] `export` in `src/lib.rs`; `run`, `effects.rs` and `demos` over it.
- [ ] The helpers in `tests/common`; the four tests over them.
- [ ] `cargo test -p nanvm-harness`, `cargo clippy -- -D warnings`,
      `cargo fmt -- --check`.

### Related

- [document-nanvm-harness](./document-nanvm-harness.md) — the README that
  would describe `common`.
