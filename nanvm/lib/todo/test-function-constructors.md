## Static-function test constructors, rebuilt in every crate

**Priority:** P4
**Status:** open

### Problem

[`vm/test/function.rs`](../src/vm/test/function.rs) owns the constructors
a test needs to make a function value: `identity`, `returns`, `throws`,
`rt`, `no_args`. It is `#[cfg(test)]`, crate-private and pinned to `Naive`,
so nothing outside the unit tests can reach it, and each test target
rebuilds what it needs: `function_any` in
[`tests/test/harness.rs`](../tests/test/harness.rs); `function` and `pure`
in [`nanvm/effects-node`](../../effects-node/src/lib.rs)'s `lib.rs` tests,
`thunk` in its `native.rs` tests; `answering` and `throwing` in
[`vm/lambda/member.rs`](../src/vm/lambda/member.rs)'s tests, which are
`returns` and `throws` with a different `length`; and the inline
`static_function(|_, _| Ok(Any::undefined()), 0, [].to_array(), None)` in
the tests of `any/get_iterator.rs`, `any/object_spread.rs`,
`any/to_json.rs`, `function/partial_eq.rs` and
`function/member_access.rs`.

### Proposal

A `test-support` feature on `nanvm-lib`, the mechanism
[`nanvm/effects-node`](../../effects-node/todo/shared-test-support.md) set
as precedent, exporting `vm::test::function`'s constructors made generic
over `A: IVm`, which their signatures allow. `nanvm-lib`'s own `tests/`
enable it through a self dev-dependency, `effects-node` and the harness
through theirs, and the in-crate inline spellings switch to `returns` and
`identity`.

### Tasks

- [ ] The feature and the generic constructors.
- [ ] The copies above over them.
- [ ] `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt -- --check`.

### Related

- [`effects-node/todo/shared-test-support`](../../effects-node/todo/shared-test-support.md)
  — the same mechanism between the other two crates.
