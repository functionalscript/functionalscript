# 65Y-nanvm-conversion-macros. Collapse `From`/`TryFrom` wrapper impl boilerplate

**Priority:** P4
**Status:** open

## Constraint: avoid Rust macros

Per PR review on this issue: macros are not the preferred dedup tool
in this repo. They are unfriendly to grep, IDE jump-to-definition,
and rust-analyzer's hover/expansion; they also encourage a style of
"hidden code" that runs counter to FunctionalScript's preference for
explicit, locally-readable values. This issue should therefore be
solved **without `macro_rules!`**, even though declarative macros are
the idiomatic Rust answer to coherence-blocked blanket impls.

That preference is worth lifting into a project convention. **Suggested
AGENTS.md addition** (under the existing "Reuse code / DRY" bullet):

> - In Rust code, avoid `macro_rules!` for collapsing trait
>   boilerplate. Prefer (in order): a generic helper trait + per-type
>   one-line impls, a `build.rs` code generator driven from a small
>   source-of-truth table, or — if no cheaper option exists — accept
>   the hand-written duplication. Macros obscure types from IDEs and
>   grep; reach for them only when the alternative is materially worse
>   for readers.

The remainder of this issue is rewritten with that constraint in mind.

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

Both groups share one axis-of-difference: `(wrapper, variant)`.

## Options without `macro_rules!`

### A. Status quo — keep the hand-written impls

14 copies, ~120 lines, no churn. Adding a new VM variant (`Symbol<A>`)
costs four lockstep edits (`Unpacked` enum, `from.rs`, `try_from.rs`,
`serializable.rs`); the asymmetry between `From` and `TryFrom` for the
same `(wrapper, variant)` pair is invisible at compile time and
detected only by tests.

This is the cheapest option *today*; it remains a viable answer if
none of B/C lands a clean enough improvement.

### B. Generic helper trait + one-line impls

Coherence still blocks `impl<T> From<T> for Unpacked<A>`, but a
**sealed trait** can carry the variant choice and let each leaf type
opt in with one line:

```rust
// vm/impls/conversions.rs
mod sealed { pub trait Sealed {} }

/// Sealed witness that `Self` is one of the seven `Unpacked` payload
/// types. The impl chooses its own variant; `From` / `TryFrom` are
/// derived once for the whole set.
pub trait UnpackedVariant<A: IVm>: sealed::Sealed + Sized {
    fn wrap(self) -> Unpacked<A>;
    fn unwrap(value: Unpacked<A>) -> Result<Self, Unpacked<A>>;
}

impl sealed::Sealed for Nullish {}
impl<A: IVm> UnpackedVariant<A> for Nullish {
    fn wrap(self) -> Unpacked<A> { Unpacked::Nullish(self) }
    fn unwrap(v: Unpacked<A>) -> Result<Self, Unpacked<A>> {
        if let Unpacked::Nullish(x) = v { Ok(x) } else { Err(v) }
    }
}
// …six more, each ~5 lines

// One blanket impl pair, written once:
impl<A: IVm, T: UnpackedVariant<A>> From<T> for Unpacked<A> {
    fn from(value: T) -> Self { value.wrap() }
}
impl<A: IVm, T: UnpackedVariant<A>> TryFrom<Any<A>> for T {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        T::unwrap(value.into()).map_err(|_| "Type Error".into())
    }
}
```

What this buys:

- The `From` ↔ `TryFrom` symmetry is enforced by the trait shape:
  every `UnpackedVariant` impl supplies both directions in one place,
  so they cannot drift.
- Adding a new variant is still one impl block (the new wrapper type),
  not three lockstep edits across `from.rs` / `try_from.rs`.
- No macros, no `build.rs`, no codegen. Plain Rust, fully visible to
  rust-analyzer.

What it costs:

- The two blanket `impl<T: UnpackedVariant>` blocks risk colliding
  with the existing `impl<A: IVm> From<Unpacked<A>> for Any<A>` in
  `from.rs:5–18`. Verify with `cargo check` that the sealed bound
  keeps coherence happy; if not, fall back to per-type one-line impls
  that call into `UnpackedVariant::wrap` / `unwrap`. The line count
  becomes ~7 lines/type instead of ~14, plus the one-time trait
  scaffolding.
- Net line count is probably similar to status quo (~120 lines) — the
  win is structural, not size.

### C. Codegen via `build.rs` from a source-of-truth table

A small `nanvm-lib/build.rs` that reads a table and emits
`from.rs` / `try_from.rs` (or one combined module) into `$OUT_DIR`,
which `lib.rs` then `include!`s. The table itself can live in
`build.rs` as a `&[(&str, &str)]` slice or in a separate data file:

```rust
// nanvm-lib/build.rs (sketch)
const VARIANTS: &[(&str, &str)] = &[
    ("Nullish",     "Nullish"),
    ("bool",        "Boolean"),
    ("f64",         "Number"),
    ("String<A>",   "String"),
    ("BigInt<A>",   "BigInt"),
    ("Object<A>",   "Object"),
    ("Array<A>",    "Array"),
    ("Function<A>", "Function"),
];

fn main() {
    let mut out = String::new();
    for (wrapper, variant) in VARIANTS {
        // emit From<wrapper> for Unpacked<A> { … Unpacked::variant(v) … }
        // emit TryFrom<Any<A>> for wrapper { … let Unpacked::variant(r) = … }
    }
    std::fs::write(format!("{}/conversions.rs", std::env::var("OUT_DIR").unwrap()), out).unwrap();
}
```

What this buys:

- Single source of truth for the variant list; adding `Symbol<A>` is
  one row.
- Generated code is plain Rust visible to rust-analyzer (after the
  first build) — no macro expansion mystery at call sites.
- The same table can drive the `serializable.rs` tag list and the
  `Unpacked` enum's variant list, which closes the broader drift
  hazard between `from.rs` / `try_from.rs` / `serializable.rs` /
  `Unpacked`.

What it costs:

- New `build.rs` infrastructure for a problem that has 14 hand-written
  lines today. Worth it only if the generator is reused for the i159
  `Serializable` / `SizedIndex` / `Index` / `PartialEq` / `Le` work
  too — otherwise the boilerplate moves from `from.rs` to `build.rs`
  and the win is marginal.
- IDE story is weaker than B: rust-analyzer sees the generated file
  but jumping to definition lands on generated code, not on a source
  table.

### D. FunctionalScript eDSL for Rust (longer-term)

The natural endpoint of C, if it pays off: write a small
FunctionalScript program that consumes the variant table and emits
Rust source. `fs/djs/transpiler` already turns DJS into JS; a
parallel Rust emitter would let the variant table live in
`fs/nanvm/conversions.f.ts` (or similar) as plain data, with the
emitter as the only Rust-aware piece. This is large enough that it
should be filed separately if and when there is appetite — flagging
it here only because PR feedback asked.

## Recommendation

Land **B (sealed trait)** as the primary attempt. It removes the
drift hazard between `From` and `TryFrom`, keeps the code grep-able
and IDE-friendly, and doesn't introduce build-time machinery. If the
sealed-trait blanket impls trip coherence rules, fall back to per-type
one-line impls that delegate to the trait — still better than today
because the variant choice lives in one place per type.

Hold **C (`build.rs`)** in reserve for the broader i159 cleanup. If
that work also benefits from a single variant table — and it
plausibly does, since `Serializable`/`SizedIndex`/`Index` follow the
same axis — `build.rs` becomes the right shared answer.

Treat the `macro_rules!` approach previously outlined in this file as
rejected.

## Why this still qualifies

- **DRY at the second-consumer bar.** Seven `From` copies and seven
  `TryFrom` copies, each pair structurally identical — well past the
  threshold AGENTS.md sets ("once the second real consumer exists").
- **Drift hazard.** The bidirectional shape (`From` push,
  `Unpacked::X(value)` pattern, `TryFrom` matching) is enforced today
  by convention. Option B encodes the symmetry in a trait; option C
  encodes it in the generator. Either is a real correctness win.
- **Same family as i159.** Both items live in `nanvm-lib/src/vm/impls/`;
  the chosen approach should be consistent with whatever i159 picks
  for the larger boilerplate cluster.

## Caveats / why this is an idea, not a mechanical edit

- **Coherence checks needed for B.** The blanket `From` / `TryFrom`
  impls might collide with the existing
  `impl<A: IVm> From<Unpacked<A>> for Any<A>` (`from.rs:5–18`) and
  with any future blanket impls. Sealed traits typically resolve
  this, but verify with `cargo check` before committing.
- **`Nullish` lacks an `A` parameter.** Both options handle this
  naturally — B because the trait is `UnpackedVariant<A>` (the impl
  fixes `A`), C because the table is just `(wrapper_str, variant_str)`
  pairs.
- **Status-quo escape hatch.** If neither B nor C is cleaner than the
  current 14 hand-written impls (e.g. B trips coherence rules
  inelegantly, C requires more `build.rs` plumbing than the savings
  justify), close this issue as "will not fix" and accept the
  duplication. That outcome is consistent with the AGENTS.md addition
  proposed above.
- **Coordinate with i159.** If i159 lands first with one approach,
  prefer to extend that approach here rather than fork a second
  pattern.

## Related

- [i159](./159-nanvm-trait-boilerplate.md) — the same boilerplate-
  collapse exercise for `Serializable` / `SizedIndex` / `Index` /
  `PartialEq` / `Le`. That issue currently proposes `macro_rules!`;
  the constraint surfaced here should be applied there too — update
  i159's "Proposal" sections to follow the same B / C / D / status-quo
  ladder before any code lands.
- `nanvm-lib/src/vm/impls/from.rs:42–87` — seven `From<X> for Unpacked<A>` impls.
- `nanvm-lib/src/vm/impls/try_from.rs:7–85` — seven `TryFrom<Any<A>> for X` impls.
- `nanvm-lib/src/vm/impls/serializable.rs:37–86` — the parallel
  `Unpacked::serialize` / `deserialize` match that gains a new arm in
  lockstep with every new variant. If option C lands, this becomes
  the third generated file driven from the same variant table.
- `AGENTS.md` — should gain the "avoid Rust macros" guidance noted at
  the top of this file. Land that AGENTS.md edit as a small separate
  PR before this issue is implemented, so the constraint is documented
  for parallel Rust work (including i159).
