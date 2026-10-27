## Structural comparers re-derive `SameValue`

**Priority:** P4
**Status:** open

### Problem

`Any::same_value` in [`vm/any/partial_eq.rs`](../src/vm/any/partial_eq.rs) is
public and is `Object.is`: `==`, except that `NaN` equals `NaN` and `0` does
not equal `-0`, through `to_bits`. Two structural comparers write the same
leaf rule again instead of calling it:

```rust
// lib/tests/test/harness.rs, `same`
(Unpacked::Number(x), Unpacked::Number(y)) => f64::from(x).to_bits() == f64::from(y).to_bits(),
…
_ => a == b,
// harness/src/compare.rs, `Walk::walk`
(Unpacked::Number(a), Unpacked::Number(e)) => { let (a, e) = (f64::from(a), f64::from(e)); if a.to_bits() == e.to_bits() { … } }
…
_ if actual == expected => Ok(()),
```

[`lib/tests/test/main.rs`](../tests/test/main.rs)'s `conversions` carries
`to_bits` assertions whose comment defends the copy in `same`. A rule stated
three times is defended three times.

### Proposal

Both comparers keep their `Array` and `Object` arms, which are the structural
walk, and take `same_value` as the leaf: `_ => a.same_value(b)` in `same`,
`_ if actual.same_value(expected) => Ok(())` in `Walk::walk`, each dropping
its `Number` arm. The `NaN`/`-0` rule then lives in one place, and the
assertions that defend the copy go.

### Tasks

- [ ] `same` and `Walk::walk` over `same_value`; `cargo test` across the
      workspace.
- [ ] Drop the defending assertions in `conversions`.

### Related

- [corpus-as-conformance-vectors](../../../fjs/nanvm/todo/corpus-as-conformance-vectors.md)
  — the same comparison asked of both executors.
