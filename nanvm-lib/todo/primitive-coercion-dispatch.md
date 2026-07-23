## primitive-coercion-dispatch. A primitive-dispatch layer for the coercion visitors

**Priority:** P4
**Status:** open

> **Extended 2026-07:** the original issue targeted only the inner 5-arm
> `Primitive` match inside `any_to_number`/`any_to_string`. A fresh read shows
> the duplication is wider — the whole "coerce `Any` → T" skeleton is repeated
> across the two files — so the design below supersedes the narrower
> `Unpacked::dispatch` one-liner (kept as the fallback option).

### Problem

`vm/number_coercion.rs` and `vm/string_coercion.rs` duplicate three layers of
the same skeleton, differing only in the preferred-type constant, the target
type, and the five primitive-method bodies:

1. **The `any_to_T` wrapper** (`number_coercion.rs:17-32`,
   `string_coercion.rs:16-31`): `a.to_primitive(Some(PREFERRED))?` followed by
   a hand-written 5-arm `Primitive` match fanning onto the visitor's five
   primitive methods — byte-identical modulo `Number`/`String` and the
   dispatcher struct.
2. **The reference-type arms** (`number_coercion.rs:70-80`,
   `string_coercion.rs:68-78`): three byte-identical arms per file —

   ```rust
   fn object(self, v: Object<A>) -> Self::Result { any_to_number(v.to_any()) }
   fn array(self, v: Array<A>) -> Self::Result { any_to_number(v.to_any()) }
   fn function(self, v: Function<A>) -> Self::Result { any_to_number(v.to_any()) }
   ```

   (`string_coercion.rs` identical modulo `any_to_string`.)
3. The 5-arm match itself (the original scope of this issue).

The only genuine content in each file is the five primitive bodies (spec
behavior per type) and the preferred type; everything else is scaffolding
spelled twice.

### Proposal

Introduce a sub-trait carrying only the genuine content, plus one blanket
impl deriving the scaffolding — AGENTS.md's preferred option (1) for
per-type boilerplate (sealed helper trait + blanket impl, no macros):

```rust
trait PrimitiveDispatch<A: IVm>: Sized {
    type Result;
    const PREFERRED: ToPrimitivePreferredType;
    fn nullish(self, v: Nullish) -> Self::Result;
    fn bool(self, v: bool) -> Self::Result;
    fn number(self, v: f64) -> Self::Result;
    fn string(self, v: String<A>) -> Self::Result;
    fn bigint(self, v: BigInt<A>) -> Self::Result;
}

// One blanket impl supplies Dispatch<A>: object/array/function all route
// through to_primitive(PREFERRED) and re-dispatch on the resulting Primitive.
impl<A: IVm, P: PrimitiveDispatch<A, Result = Result<T, Any<A>>>> Dispatch<A> for P { … }
```

This deletes both `any_to_T` wrappers and all six reference-type arms;
`NumberCoercion`/`StringCoercion` shrink to their five primitive bodies plus
`PREFERRED`. The blanket impl's exact bounds need working out against
`Dispatch`'s associated `Result` (the coercions' results are `Result<T, Any<A>>`
for different `T`); if the bounds turn out ugly, the fallback is the original
narrow fix — collapse each 5-arm match to
`Unpacked::from(a.to_primitive(Some(PREFERRED))?).dispatch(Self)` — which
still leaves layers 1–2 duplicated but is a one-line change per file.

### Tasks

- [ ] Prototype the `PrimitiveDispatch` sub-trait + blanket `Dispatch` impl;
      verify the associated-type bounds are workable.
- [ ] Port `NumberCoercion` and `StringCoercion`; delete `any_to_number`/
      `any_to_string` and the six reference arms.
- [ ] If the bounds fight back, land the `Unpacked::dispatch` fallback and
      record why here.
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [159](./159.md) — wrapper-trait boilerplate cluster; its Notes flag the
  `string_coercion.rs` copy. Update that note when this lands.
- [65y-nanvm-conversion-macros.md](./65y-nanvm-conversion-macros.md) —
  adjacent conversion boilerplate; different site.
