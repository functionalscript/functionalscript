## read-default-test-helper. Every harness test spells the same run of a fixture's default export

**Priority:** P4
**Status:** open

### Problem

The tests in `src/lib.rs` all do one thing — run a fixture, read its
default export, compare the JSON — and each writes the whole call:

```rust
// tests::operators, and about forty more at ef756f0
assert_eq!(
    run::<Naive>(operators::module, "default", Action::Read),
    Ok("[7,5,…]".into())
);
```

Two tests that need the value rather than its text,
`bigint_literals` and `missing_argument_and_non_function_callee`, spell
the read by hand instead:
`module().unwrap().dot("default".into()).end().unwrap()`. The fixture
and the expected text are the only facts a test carries; the rest is
the harness's own API restated per test, so a change to `run`'s
signature or to how a default export is read touches every test.

### Proposal

Two helpers in the test module:

```rust
/// The fixture's default export as JSON text, the way every table test reads it.
fn read_default(module: fn() -> Result<Any<Naive>, Any<Naive>>) -> Result<String, RunError<Naive>>
/// The fixture's default export as a value.
fn default_export(module: fn() -> Result<Any<Naive>, Any<Naive>>) -> Any<Naive>
```

A one-assert test becomes `assert_eq!(read_default(operators::module), Ok("…".into()))`,
and the tests that are nothing but one such line can become one table of
`(module, expected)` rows, so adding a fixture adds a row.

### Tasks

- [ ] `read_default` and `default_export`; the tests through them.
- [ ] Decide whether the one-assert tests become a table.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [one-fixture-list](./one-fixture-list.md) — the fixture `use` list the
  same tests carry; a table of rows is where its generated list would
  be consumed.
- [ivm-generic-eq-debug](../../nanvm-lib/todo/ivm-generic-eq-debug.md) —
  `RunError`'s hand-written `Debug`/`PartialEq`, which these
  `assert_eq!`s depend on.
