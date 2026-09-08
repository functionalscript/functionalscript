## bigint-divmod-owner. `Div` and `Rem` each rebuild the divmod protocol

**Priority:** P5
**Status:** open

### Problem

`src/vm/bigint/div.rs` and `src/vm/bigint/rem.rs` each call
`abs_divmod_vec` — computing both the quotient and the remainder — and
discard half, and around that call each re-spells the same protocol: the
`rhs.is_zero()` guard returning `DIVISION_BY_ZERO`, and the
`if result.is_empty() { Self::default() } else { Self::unchecked_new(sign, result) }`
packing. Only the sign rule genuinely differs (quotient: sign product;
remainder: dividend's sign). The zero-divisor guard existing twice is the
kind of pair that drifts — an error-message or ordering change lands in one
operator and not the other.

### Proposal

One method owning the guard, the division, and both sign rules:

```rust
impl<A: IVm> BigInt<A> {
    /// Truncating division: `(self / rhs, self % rhs)`.
    pub fn div_mod(self, rhs: Self) -> Result<(Self, Self), Any<A>>
}
```

`Div` and `Rem` become projections of `div_mod`. This also gives the VM the
pair operation directly for any future call site that needs both halves —
today such a caller would run the schoolbook division twice.

### Tasks

- [ ] Add `div_mod`; express `Div`/`Rem` through it; the shared
      empty-magnitude packing moves with it.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [sign-algebra](./sign-algebra.md) — `impl Mul for Sign` gives `div_mod`'s
  quotient sign its one-line spelling; either order works.
