## ivm-from-unpacked. Collapse `IVm`'s eight `From` bounds to `From<Unpacked<Self>>`

**Priority:** P4
**Status:** open

### Problem

The eight-variant table is restated in two places that are both derivable from
the `From<X> for Unpacked` impl set. `src/vm/internal/mod.rs:13-24` spells it
as supertrait bounds:

```rust
pub trait IVm:
    Sized
    + Clone
    + From<Nullish>
    + From<bool>
    + From<f64>
    + From<String<Self>>
    + From<BigInt<Self>>
    + From<Object<Self>>
    + From<Array<Self>>
    + From<Function<Self>>
```

and `src/vm/impls/from.rs:5-18` as an eight-arm match:

```rust
impl<A: IVm> From<Unpacked<A>> for Any<A> {
    fn from(value: Unpacked<A>) -> Self {
        match value {
            Unpacked::Nullish(n) => n.to_any(),
            Unpacked::Boolean(b) => b.to_any(),
            ...
            Unpacked::Function(f) => f.to_any(),
        }
    }
}
```

Adding a variant currently means touching both, plus the `From<X> for
Unpacked` impls. The proof that this collapses is already in the crate:
`src/naive/mod.rs:14-18` writes
`impl<T: Into<Unpacked<Naive>>> From<T> for Naive`, i.e. `Naive` already
satisfies `From<Unpacked<Naive>>` and derives all eight variant conversions
from it.

### Proposal

No macros needed:

- `IVm: Sized + Clone + From<Unpacked<Self>>` replaces the eight bounds.
- `ToAny::to_any` (`src/vm/any/to_any.rs`) bounds on
  `Self: Into<Unpacked<A>>` with body `Any(Unpacked::from(self).into())`.
- `From<Unpacked<A>> for Any<A>` becomes `Any(value.into())` — the match
  disappears.

Deletes ~20 lines and removes two of the places a new variant must be
registered.

### Tasks

- [ ] Rewrite the `IVm` bound, `ToAny`, and `impls/from.rs`; check no caller
      relied on the direct `From<X> for A` bounds (they still hold via
      `X → Unpacked<Self> → Self`, but the *trait bound* changes shape).
- [ ] `cargo test`, `cargo clippy`, `cargo fmt -- --check`.

### Related

- [65Y-nanvm-conversion-macros](./65y-nanvm-conversion-macros.md) — targets
  the `From<X> for Unpacked` / `TryFrom` copies themselves; complementary,
  and both reduce the per-variant registration count.
- [159](./159.md) — the wrapper-trait boilerplate; same spirit at the
  container layer.
