## `Numeric` operators are split across three modules

**Priority:** P3
**Status:** open

### Problem

`Numeric<A>` owns `Mul` (`src/vm/numeric.rs:14-23`) but its unary minus is
open-coded on `Any` in `src/vm/any/neg.rs:9-16`:

```rust
match self.to_numeric() {
    Ok(Numeric::Number(n)) => { let m = -n; Ok(Unpacked::Number(m).into()) }
    Ok(Numeric::BigInt(bi)) => Ok(Unpacked::BigInt(-bi).into()),
    Err(e) => Err(e),
}
```

Three problems visible in that block: (a) `Numeric`'s negation lives outside
`numeric.rs`, so "what can you do with a `Numeric`" finds only `Mul`;
(b) `Err(e) => Err(e)` is a hand-written `?`; (c) the `Numeric → Unpacked`
wrapping is re-derived per variant — the sibling `Primitive<A>` has
`impl From<Primitive<A>> for Unpacked<A>` (`src/vm/primitive.rs:15-24`) but
`Numeric` has no such impl, which is why both `neg.rs` and `Numeric::mul`
wrap by hand. `Mul for Numeric` also boxes into `Any` inside the operator
(`Output = Result<Any<A>, Any<A>>`) instead of staying in the numeric
domain.

### Proposal

In `numeric.rs`:

- `impl<A: IVm> Neg for Numeric<A> { type Output = Self; … }` (negation
  never throws);
- `impl<A: IVm> From<Numeric<A>> for Unpacked<A>`;
- change `Mul for Numeric` to `Output = Result<Numeric<A>, Any<A>>`.

`Any::neg` collapses to `Ok((-self.to_numeric()?).into())` and
`Mul for Any` to `Ok((self.to_numeric()? * rhs.to_numeric()?)?.into())`.
Every future numeric operator (`-`, `/`, `%`, `**`) then has one obvious
home.

### Tasks

- [ ] Add `Neg` and `From<Numeric> for Unpacked` in `numeric.rs`
- [ ] Retype `Mul for Numeric`; simplify `any/neg.rs` and `impls/mul.rs`

### Related

- [86](86.md) — coercion traits for a future VM, a different layer
- [sign-algebra](sign-algebra.md) — the same "give the type its algebra"
  move for `Sign`
