## numeric-binary-operator-zip. One owner for the mixed-operand rule in `Numeric`'s binary operators

**Priority:** P4
**Status:** open

### Problem

`src/vm/numeric.rs` states the ECMAScript mixed-operand rule — same-typed
operands combine, a `Number`/`BigInt` mix throws — twelve times, once per
binary operation: `Add` (`:52`), `Mul` (`:64`), `Sub` (`:76`), `Rem`
(`:88`), `Div` (`:100`), `BitAnd` (`:112`), `BitOr` (`:126`), `BitXor`
(`:140`), `Shl` (`:154`), `Shr` (`:168`), plus `pow` (`:201`) and
`unsigned_right_shift` (`:231`). Every impl is the same three-arm skeleton:

```rust
Ok(match (self, rhs) {
    (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a + b),
    (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a + b),
    _ => return Err(CANNOT_MIX_NUMBER_AND_BIGINT.into()),
})
```

Only the two payload expressions differ. `Rem`/`Div` even format the same
arms differently from their siblings for no semantic reason, and the three
bitwise impls each restate the `to_int32(a) OP to_int32(b)` pairing.

One level up, the `Any` operators repeat their own skeleton nine times —
`any/{sub,div,rem,bitand,bitor,bitxor,shl,shr}.rs` and `impls/mul.rs` are
each

```rust
Ok(Unpacked::from((self.to_numeric()? OP rhs.to_numeric()?)?).into())
```

modulo the operator token: the "coerce both sides, apply, re-pack" rule has
nine owners.

### Proposal

A named combinator on `Numeric` owning the match and the error:

```rust
impl<A: IVm> Numeric<A> {
    fn zip(
        self,
        rhs: Self,
        number: impl FnOnce(f64, f64) -> Result<Self, Any<A>>,
        bigint: impl FnOnce(BigInt<A>, BigInt<A>) -> Result<Self, Any<A>>,
    ) -> Result<Self, Any<A>>
}
```

Each operator impl body becomes one `self.zip(rhs, …, …)` call — the
closures carry exactly the per-operation content (fallibility included:
`Rem`'s bigint arm is `|a, b| Ok(Numeric::BigInt((a % b)?))`,
`unsigned_right_shift`'s is the error). A small
`int32_op(impl Fn(i32, i32) -> i32)` on the number side removes the three
`to_int32` pairings too. The mixed-operand arm — and the constant it names —
gets one owner; a new operator cannot forget it.

Secondary (optional, smaller win since each `Any` impl is already one
line): an `Any::numeric_op(rhs, f)` helper owning the coerce-and-re-pack
shape, so the nine `Any`-level bodies say only which `Numeric` operation
they lift.

### Tasks

- [ ] Add `Numeric::zip` (and `int32_op` if it carries its weight); rewrite
      the twelve operator bodies through it.
- [ ] Decide on `Any::numeric_op`; apply or record why not here.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [operator-impl-placement](./operator-impl-placement.md) — moves
  `impls/mul.rs` to `vm/any/mul.rs`; placement only, but the same files —
  land in either order, cross-check the file list.
- [error-constructors](./error-constructors.md) — covers the
  `CANNOT_MIX_NUMBER_AND_BIGINT` constant itself, not the twelve match
  skeletons around it.
