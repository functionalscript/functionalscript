## Coerce bigints to decimal strings

**Priority:** P3
**Status:** open

### Problem

`StringCoercion::bigint` (`src/vm/string_coercion.rs`) formats through `Debug`:

```rust
fn bigint(self, v: BigInt<A>) -> Self::Result {
    // TODO: we should use different algorithm for large numbers.
    to_result(&format!("{v:?}"))
}
```

`Debug` for `BigInt` prints hexadecimal with an `n` suffix, so `String(123n)`
returns `"0x7Bn"` where JavaScript returns `"123"`, and `String(-456n)` returns
`"-0x1C8n"` instead of `"-456"`. `ToString` on a bigint is
[decimal by specification](https://tc39.es/ecma262/#sec-numeric-types-bigint-tostring)
unless an explicit radix is passed to `BigInt.prototype.toString`.

Two cases in the shared operator test data
([`fjs/nanvm/module.f.mjs`](../../fjs/nanvm/module.f.mjs), `stringCoercion`)
carry a `rust` reason pointing here and are therefore commented out in
`tests/test/generated.rs`. Deleting those two `rust` reasons and regenerating
is the acceptance test for this issue.

### Proposal

Convert the limb vector to decimal digits: repeatedly divide the magnitude by
the largest power of ten that fits in a limb (`10^19` for `u64`), emitting 19
digits per step and zero-padding all but the most significant group, then
prefix `-` for a negative sign. That is O(n²) in the number of limbs, which is
the same complexity the existing `Debug` path has and is fine at the sizes the
VM sees today; a divide-and-conquer split is a later optimization, not a
blocker.

`Debug` keeps its hexadecimal form — it is a developer-facing dump of the limb
representation, and the bigint formatting tests in
[`tests/test/main.rs`](../tests/test/main.rs) pin it deliberately.

### Tasks

- [ ] Add decimal conversion for `BigInt<A>`.
- [ ] Use it from `StringCoercion::bigint`.
- [ ] Remove the two `rust` reasons from `stringCoercion` in the shared test
      data and regenerate `tests/test/generated.rs`.

### Related

- [`nanvm-lib/tests/README.md`](../tests/README.md) — how the shared operator
  test data records divergences like this one.
- [mvp-roadmap](./mvp-roadmap.md) — the operators task this belongs to.
