## ordinary-to-primitive-shared. One `OrdinaryToPrimitive`, not three

**Priority:** P4
**Status:** open

### Problem

`src/vm/primitive_coercion.rs` writes the spec's `OrdinaryToPrimitive`
method-ordering rule — try `valueOf` then `toString` for a Number
preference, the reverse for a String preference, else throw — three times,
once per reference type. `obj_to_primitive` (`:70-90`),
`arr_to_primitive` (`:92-112`) and `fn_to_primitive` (`:114-134`) are
byte-identical except for which `*_to_string` helper they name:

```rust
match preferred_type {
    ToPrimitivePreferredType::Number => match value_of(o.clone()) {
        Some(res) => res,
        None => match obj_to_string(o) {          // arr_to_string / fn_to_string
            Some(res) => res,
            None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
        },
    },
    ToPrimitivePreferredType::String => match obj_to_string(o.clone()) {
        Some(res) => res,
        None => match value_of(o) {
            Some(res) => res,
            None => Err(CANNOT_CONVERT_TO_PRIMITIVE_VALUE.into()),
        },
    },
}
```

`value_of` is already generic over the receiver (`:30-38`); only the
`to_string` half varies. The three `Dispatch` arms that call them
(`:164-177`) also each re-spell
`self.0.unwrap_or(ToPrimitivePreferredType::Number)` with the same
spec-reference comment.

When user-defined `valueOf`/`toString` lands (the `TODO`s at `:34`, `:42`,
`:51`, `:64`), the ordering rule must change in three places in lockstep —
and a divergence would be a silent spec bug for one reference type only.

### Proposal

One generic function owning the ordering rule; no macros needed:

```rust
fn ordinary_to_primitive<A: IVm, T: Clone>(
    v: T,
    preferred_type: ToPrimitivePreferredType,
    to_string: impl FnOnce(T) -> Option<Result<Primitive<A>, Any<A>>>,
) -> Result<Primitive<A>, Any<A>>
```

Each branch calls `to_string` at most once, so `FnOnce` suffices; `value_of`
is reached directly since it is already generic. The three `Dispatch` arms
become one-liners — `ordinary_to_primitive(o, self.preferred(), obj_to_string)`
— with the `unwrap_or(Number)` default and its spec comment moved into a
single accessor on `PrimitiveCoercionOp`. Deletes ~50 lines and makes the
rule single-owner before the user-defined-method work touches it.

### Tasks

- [ ] Extract `ordinary_to_primitive`; rewrite `obj_to_primitive`/
      `arr_to_primitive`/`fn_to_primitive` call sites through it and delete
      the three copies.
- [ ] Hoist the `unwrap_or(Number)` default into one accessor.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [primitive-coercion-dispatch](./primitive-coercion-dispatch.md) — the
  coerce-`Any`-to-T scaffolding in `number_coercion.rs`/`string_coercion.rs`;
  a different layer of the same coercion stack, explicitly scoped away from
  this file's `OrdinaryToPrimitive` triplication.
- [error-constructors](./error-constructors.md) — covers only the
  `CANNOT_CONVERT_TO_PRIMITIVE_VALUE` constant, not the match skeleton
  around it.
