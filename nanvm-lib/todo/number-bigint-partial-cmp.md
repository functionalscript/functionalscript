## number-bigint-partial-cmp. The mixed `Number`/`BigInt` comparison is written twice, mirrored, as `Option<bool>`

**Priority:** P4
**Status:** open

### Problem

`vm/any/relational.rs` compares a `Number` with a `BigInt` in two
functions that are each other's mirror image, with the NaN and infinity
guards restated and the operators swapped by hand:

```rust
fn number_lt_bigint<A: IVm>(a: Number, b: &BigInt<A>) -> Option<bool> {
    if a.is_nan() { return None; }
    if !a.is_finite() { return Some(a < 0.into()); }
    Some(compare_bigint_number(b, a) == Ordering::Greater)
}
fn bigint_lt_number<A: IVm>(a: &BigInt<A>, b: Number) -> Option<bool> {
    if b.is_nan() { return None; }
    if !b.is_finite() { return Some(b > 0.into()); }
    Some(compare_bigint_number(a, b) == Ordering::Less)
}
```

`compare_bigint_number` answers an `Ordering` but accepts only finite
input, so every caller carries the guards. `numeric_less_than` then
flattens each arm to an `Option<bool>` — the Number/Number arm has an
`Option<Ordering>` from `partial_cmp` and throws it away — and `lt`,
`gt`, `le`, `ge` rebuild their meaning from that boolean with
`unwrap_or(false)` and `!… .unwrap_or(true)`.

The type that fits the specification's three-valued answer is
`Option<Ordering>`, `None` for *undefined*, and three of the four arms
already have one.

### Proposal

One function owns the guards:

```rust
/// `None` where either side is NaN; the infinities order against any bigint.
fn partial_cmp_bigint_number<A: IVm>(a: &BigInt<A>, b: Number) -> Option<Ordering>
```

`Numeric<A>` gets a `partial_cmp` (or `impl PartialOrd`) whose mixed arm
is that function, reversed for the other operand order, and the four
operators become `matches!` on `Some(Less)`, `Some(Less | Equal)` and
their mirrors. `number_lt_bigint` and `bigint_lt_number` go.

### Tasks

- [ ] `partial_cmp_bigint_number` with the NaN and infinity cases tested
      once, both operand orders.
- [ ] `Numeric` partial ordering; the four operators on it.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [bigint-eq-cmp-owner](./bigint-eq-cmp-owner.md) — bigint against
  bigint; this is bigint against number.
- [numeric-binary-operator-zip](./numeric-binary-operator-zip.md) — the
  mixed-operand rule of the arithmetic operators; the relational ones
  are the same shape with a different answer type.
