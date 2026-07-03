## primitive-coercion-dispatch. Route `any_to_number`/`any_to_string` through `Unpacked::dispatch`

**Priority:** P4
**Status:** open

### Problem

`vm/number_coercion.rs:25-31` and `vm/string_coercion.rs:24-30` each map a
`Primitive<A>` onto the five primitive methods of a `Dispatch` impl with the
same hand-written 5-arm match, byte-identical modulo the dispatcher:

```rust
match a.to_primitive(Some(ToPrimitivePreferredType::Number))? {
    Primitive::Nullish(n) => NumberCoercion.nullish(n),
    Primitive::Boolean(b) => NumberCoercion.bool(b),
    Primitive::Number(n) => NumberCoercion.number(n),
    Primitive::String(s) => NumberCoercion.string(s),
    Primitive::BigInt(bi) => NumberCoercion.bigint(bi),
}
```

The fan-out primitive already exists: `Unpacked<A>::dispatch`
(`vm/unpacked.rs`) covers all 8 variants, `From<Primitive<A>> for
Unpacked<A>` exists (`vm/primitive.rs`), and both `NumberCoercion` and
`StringCoercion` are full `Dispatch<A>` impls (their object/array/function
arms are what `to_primitive` guarantees unreachable — verify how they're
implemented before relying on them).

[159](./159.md)'s Notes flag the `string_coercion.rs` copy as "worth noting
separately"; this is that separate note, extended to the pair — which makes
it a real 2-consumer DRY case, actionable today with plain code (no macro,
no trait scaffolding).

### Proposal

Each helper collapses to one line:

```rust
Unpacked::from(a.to_primitive(Some(ToPrimitivePreferredType::Number))?).dispatch(NumberCoercion)
```

Precondition to verify: the `Dispatch` impls' object/array/function arms
must behave sensibly if ever reached (today they can't be, since
`to_primitive` never returns an object) — if they `unreachable!()`, keep
them, since the invariant is unchanged; if they're absent, this refactor is
what forces writing them, and a 3-method cost may outweigh the 5-arm dedup.
Decide with the code in front of you; if the trade is bad, close as
won't-fix with a comment at both match sites cross-referencing each other.

### Tasks

- [ ] Check `NumberCoercion`/`StringCoercion`'s non-primitive `Dispatch`
      arms; collapse both matches if the trade is favorable.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [159](./159.md) — Notes section mentions the `string_coercion.rs` copy;
  update that note to point here (or delete it) when this lands.
