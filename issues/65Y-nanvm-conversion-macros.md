# 65Y-nanvm-conversion-macros. Collapse `From`/`TryFrom` wrapper impl boilerplate

**Priority:** P4
**Status:** open

## Problem

`nanvm-lib/src/vm/impls/from.rs` and `nanvm-lib/src/vm/impls/try_from.rs`
each carry a per-VM-wrapper impl set that is byte-identical modulo a
variant name and a type argument. These are the same kind of nominal-
newtype repetition that [i159](./159-nanvm-trait-boilerplate.md)
addresses for `Serializable` / `SizedIndex` / `Index` / `PartialEq` /
`Le`, but the conversion traits are **not covered** there.

### `From<X> for Unpacked<A>` — 7 copies (`from.rs:42–87`)

```rust
impl<A: IVm> From<Nullish>     for Unpacked<A> { fn from(v: Nullish)     -> Self { Unpacked::Nullish(v) } }
impl<A: IVm> From<bool>        for Unpacked<A> { fn from(v: bool)        -> Self { Unpacked::Boolean(v) } }
impl<A: IVm> From<f64>         for Unpacked<A> { fn from(v: f64)         -> Self { Unpacked::Number(v) } }
impl<A: IVm> From<String<A>>   for Unpacked<A> { fn from(v: String<A>)   -> Self { Unpacked::String(v) } }
impl<A: IVm> From<BigInt<A>>   for Unpacked<A> { fn from(v: BigInt<A>)   -> Self { Unpacked::BigInt(v) } }
impl<A: IVm> From<Object<A>>   for Unpacked<A> { fn from(v: Object<A>)   -> Self { Unpacked::Object(v) } }
impl<A: IVm> From<Array<A>>    for Unpacked<A> { fn from(v: Array<A>)    -> Self { Unpacked::Array(v) } }
impl<A: IVm> From<Function<A>> for Unpacked<A> { fn from(v: Function<A>) -> Self { Unpacked::Function(v) } }
```

### `TryFrom<Any<A>> for X` — 7 copies (`try_from.rs:7–85`)

```rust
impl<A: IVm> TryFrom<Any<A>> for Nullish {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Nullish(result) = value.into() else { return error(); };
        Ok(result)
    }
}
// …repeated for bool, f64, Array<A>, BigInt<A>, Function<A>, Object<A>, String<A>
```

Both groups share the same pair of axes — *(wrapper newtype,
`Unpacked` variant)* — and differ only on those two tokens. Same root
cause as the i159 cluster: per-wrapper nominal newtypes block a blanket
impl under coherence, so the dedup tool is a declarative macro.

## Proposal

Two macros in a new `vm/impls/macros.rs` (or inline at the top of each
file), invoked once per `(wrapper, variant)` pair. Both `from.rs` and
`try_from.rs` collapse to a list of macro invocations plus a one-line
table of pairs.

```rust
// vm/impls/macros.rs
macro_rules! impl_from_unpacked {
    ($wrapper:ty, $variant:ident) => {
        impl<A: IVm> From<$wrapper> for Unpacked<A> {
            fn from(value: $wrapper) -> Self { Unpacked::$variant(value) }
        }
    };
}

macro_rules! impl_try_from_any {
    ($wrapper:ty, $variant:ident) => {
        impl<A: IVm> TryFrom<Any<A>> for $wrapper {
            type Error = Any<A>;
            fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
                let Unpacked::$variant(result) = value.into() else { return error(); };
                Ok(result)
            }
        }
    };
}
```

A combined macro can emit both directions for the pairs that share the
same `(wrapper, variant)`:

```rust
macro_rules! impl_unpacked_conv {
    ($wrapper:ty, $variant:ident) => {
        impl_from_unpacked!($wrapper, $variant);
        impl_try_from_any!($wrapper, $variant);
    };
}

impl_unpacked_conv!(Nullish,     Nullish);
impl_unpacked_conv!(bool,        Boolean);
impl_unpacked_conv!(f64,         Number);
impl_unpacked_conv!(String<A>,   String);
impl_unpacked_conv!(BigInt<A>,   BigInt);
impl_unpacked_conv!(Object<A>,   Object);
impl_unpacked_conv!(Array<A>,    Array);
impl_unpacked_conv!(Function<A>, Function);
```

That single table replaces ~140 lines across the two files with ~30 —
and, more importantly, ensures the two directions stay in lockstep when
a future ninth variant is added.

## Why this qualifies

- **DRY at the second-consumer bar.** Seven `From` copies and seven
  `TryFrom` copies, each pair structurally identical — well past the
  threshold AGENTS.md sets ("once the second real consumer exists").
- **Single-axis-of-change collapse.** Adding a new VM value type (e.g.
  `Symbol<A>`) today requires touching at least four files: the
  `Unpacked` enum, `from.rs`, `try_from.rs`, plus
  `vm/impls/serializable.rs` for the tag. The macro reduces the
  `From`/`TryFrom` part to a single new line.
- **Drift hazard removed.** The bidirectional shape (`From` push, the
  `Unpacked::X(value)` shape, the `TryFrom` matching pattern) is
  enforced by the macro instead of by convention. If someone alters
  one direction without the other today, only a runtime test would
  notice; with the macro, the asymmetry is impossible to express.
- **Same family as i159.** Both items live in `nanvm-lib/src/vm/impls/`;
  picking the same macro patterns and same file conventions keeps the
  cleanup cohesive. This is the third "wrapper impl boilerplate" file
  in the same directory and should be folded into the i159 plan rather
  than landed on its own architectural pattern.

## Caveats / why this is an idea, not a mechanical edit

- **`Any<A>` is missing on purpose.** `try_from.rs` defines `TryFrom`
  for the seven non-`Any` types only — `Any<A>` is the source type, and
  `From<Unpacked<A>> for Any<A>` (in `from.rs:5–18`) is the
  catch-all match-on-variant. Keep that one hand-written; the macro is
  only for the seven leaf wrappers.
- **`Nullish` is special.** It is a plain enum (no `A` parameter), so
  the macro must accept both `Nullish` and `String<A>`-shaped wrappers.
  The `$wrapper:ty` token-class above handles both — verify against
  `rustc` once before finalizing.
- **Macro placement.** Two options: (a) a new
  `vm/impls/macros.rs` that both `from.rs` and `try_from.rs` import,
  or (b) a single combined `vm/impls/conversions.rs` that replaces both
  files. Option (b) is cleaner once the macros exist — the two
  separate files only had separate identities because they each held
  seven manual impls. Pick at implementation time.
- **Coordinate with i159.** If i159 lands first with a generic
  `container_traits!` macro in `vm/impls/macros.rs`, prefer to add
  these arms next to it rather than starting a parallel macro file.

## Related

- [i159](./159-nanvm-trait-boilerplate.md) — the same boilerplate-
  collapse exercise for `Serializable` / `SizedIndex` / `Index` /
  `PartialEq` / `Le`. This issue extends the same plan to the
  `From` / `TryFrom` direction and should be implemented in the
  same PR series.
- `nanvm-lib/src/vm/impls/from.rs:42–87` — seven `From<X> for Unpacked<A>` impls.
- `nanvm-lib/src/vm/impls/try_from.rs:7–85` — seven `TryFrom<Any<A>> for X` impls.
- `nanvm-lib/src/vm/impls/serializable.rs:37–86` — the parallel
  `Unpacked::serialize` / `deserialize` match that gains a new arm in
  lockstep with every new variant. After this issue and i159 land,
  consider whether the tag table + variant list itself should be
  driven from the same single source of truth.
