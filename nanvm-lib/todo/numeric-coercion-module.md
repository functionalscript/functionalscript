## numeric-coercion-module. ToNumeric has no module and rebuilds an `Any` just to unpack it

**Priority:** P4
**Status:** open

### Problem

Three of the four ECMAScript coercion abstract operations each own a module —
`number_coercion.rs` (ToNumber), `string_coercion.rs` (ToString),
`primitive_coercion.rs` (ToPrimitive). The fourth, ToNumeric, is an inline
method body on `Any` (`src/vm/any/mod.rs:71-82`), sitting between
`to_string`/`to_number`, which are one-line `dispatch` delegations:

```rust
pub fn to_numeric(self) -> Result<Numeric<A>, Any<A>> {
    // https://tc39.es/ecma262/#sec-tonumeric
    let prim_value = self.to_primitive(Some(ToPrimitivePreferredType::Number))?;
    match prim_value {
        Primitive::BigInt(bi) => Ok(Numeric::BigInt(bi)),
        _ => {
            let u: Unpacked<A> = prim_value.into();
            let any: Any<A> = u.into();
            Ok(Numeric::Number(any.to_number()?))
        }
    }
}
```

Besides the placement, the `_` arm packs a value it has fully in hand —
`Primitive → Unpacked → Any` (allocating through `to_any`) — purely so
`to_number` can start by unpacking it again and re-running `to_primitive` on
a value already known to be primitive.

The operation already has a second, hand-inlined copy:
`primitive_to_numeric` in `src/vm/any/relational.rs:66-74` is exactly this
body minus the leading `to_primitive` call — its own doc comment says it is
"the non-`BigInt` half of `Any::to_numeric`". The proposed
`to_numeric(p: Primitive<A>)` is precisely that function; the relational
operators are its second consumer, and landing the refactor without
deleting `primitive_to_numeric` would leave the copy behind.

### Proposal

A sibling `src/vm/numeric_coercion.rs` owning the operation over the type it
actually needs:

```rust
pub fn to_numeric<A: IVm>(p: Primitive<A>) -> Result<Numeric<A>, Any<A>>
```

dispatching the non-bigint arms directly onto the number-coercion primitive
methods (no `Any` round trip), with `Any::to_numeric` reduced to a one-liner
like its `to_string`/`to_number` siblings:
`Ok(match self.to_primitive(...)? { ... })` → `numeric_coercion::to_numeric`.

### Tasks

- [ ] Add `numeric_coercion.rs`; move the body; make the non-bigint arms call
      `NumberCoercion`'s primitive handlers directly.
- [ ] Replace `primitive_to_numeric` in `src/vm/any/relational.rs` with the
      new function and delete the copy.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [primitive-coercion-dispatch](./primitive-coercion-dispatch.md) — the
  shared coerce-`Any`-to-T skeleton for `number_coercion.rs` /
  `string_coercion.rs`; this issue adds the third operation to that layer's
  scope.
- `src/vm/numeric.rs` — `Numeric` owns arithmetic operators; this issue
  explicitly leaves the coercion layer out, which it covers.
