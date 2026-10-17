## `Primitive` is narrowed out of `Unpacked` by hand in three places

**Priority:** P3
**Status:** open

### Problem

`vm/primitive.rs` has `From<Primitive<A>> for Unpacked<A>` and no inverse, so
the inverse is written where it is needed. `to_primitive_value` in
`vm/primitive_coercion.rs` matches the five primitive variants into `Some`
and the three others into `None`; the `Dispatch` impl for
`PrimitiveCoercionOp` in the same file is the identity on the five
primitives, one method each, with the three object arms doing the work;
`to_numeric` in `vm/numeric_coercion.rs` routes each primitive variant to
`NumberCoercion`'s method of the same name, arm by arm.

```rust
// primitive_coercion.rs: the inverse of From<Primitive> for Unpacked, by hand
Unpacked::Nullish(n) => Some(Primitive::Nullish(n)),
Unpacked::Boolean(b) => Some(Primitive::Boolean(b)),
// …
Unpacked::Object(_) | Unpacked::Array(_) | Unpacked::Function(_) => None,
// numeric_coercion.rs
Primitive::Nullish(n) => Numeric::Number(NumberCoercion.nullish(n)?),
Primitive::Boolean(b) => Numeric::Number(NumberCoercion.bool(b)?),
```

A new primitive variant is three edits that must agree.

### Proposal

`impl<A: IVm> TryFrom<Unpacked<A>> for Primitive<A> { type Error =
Unpacked<A>; }` in `vm/primitive.rs`, beside the `From` it inverts, the `Err`
handing the object, array or function back unchanged. Then
`to_primitive_value` is `Primitive::try_from(v.into()).ok()`;
`Any::to_primitive` is a three-arm match on the `Err` — object through
`ordinary_to_primitive` with the object method, array with `arr_to_string`,
function with its text — and the `Dispatch` impl goes; `to_numeric` is
`Primitive::BigInt(b) => Numeric::BigInt(b)`, and
`Numeric::Number(Any::from(p).to_number()?)` otherwise. `to_primitive_or_text`
in `vm/any/relational.rs` keeps its function case and reads the same
conversion.

### Tasks

- [ ] `TryFrom<Unpacked<A>> for Primitive<A>`.
- [ ] `to_primitive_value`, `Any::to_primitive` and `to_numeric` through it;
      the `Dispatch` impl for `PrimitiveCoercionOp` goes.

### Related

- [to-primitive](./to-primitive.md) — what the conversion answers; this is
  how it is written.
- [089-rust-unpack-dispatch](./089-rust-unpack-dispatch.md) — `Dispatch`,
  which the identity arms put to no use.
