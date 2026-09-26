## 159. nanvm-lib: collapse per-type wrapper trait boilerplate

**Priority:** P3
**Status:** open

The VM wrapper newtypes (`String<A>`, `Array<A>`, `Object<A>`, `BigInt<A>`,
`Function<A>`) each carry a directory of one-impl-per-file trait
implementations that are identical modulo the wrapper type and one associated
type. Rust's coherence rules block a blanket `impl` over the wrappers
themselves (each wrapper is a distinct nominal newtype over a *different*
`A::InternalX`). The mechanism follows the ladder in
[`nanvm-lib/AGENTS.md`](../AGENTS.md#21-avoid-macro_rules) — a sealed helper
trait, then a `build.rs` generator from a table, then accepting the
duplication — never `macro_rules!`; see
[65Y-nanvm-conversion-macros](./65y-nanvm-conversion-macros.md) for the same
axis worked through for `From`/`TryFrom`.

The container internals are already well-abstracted — `IContainer`
(`vm/internal/icontainer.rs`) carries the default structural-equality
body, `ContainerFmt` centralizes `Debug`, and bigint
`add`/`sub` already share `abs_add_vec`/`abs_sub_vec`/`abs_cmp_vec`
(`vm/bigint/mod.rs`). The remaining repetition is in the thin
*wrapper* impls that delegate to those internals.

### 1. `SizedIndex<u32>`, `Index<u32>`

These two traits are declared in lockstep across the per-type directories
and are byte-identical except for the wrapper and its output/associated type:

```rust
// string/sized_index.rs  (array/object/bigint: body verbatim identical)
impl<A: IVm> SizedIndex<u32> for String<A> {
    fn length(&self) -> u32 { self.0.items().length() as u32 }
}

// string/index.rs  (array/object/bigint: identical except `type Output`)
impl<A: IVm> Index<u32> for String<A> {
    type Output = u16;
    fn index(&self, index: u32) -> &Self::Output { self.0.items().index(index as usize) }
}
```

Instances: four of each, for `String`, `Array`, `Object` and `BigInt`, whose
`Output` is `u16`, `Any<A>`, `Property<A>` and `u64`. `Function` keeps its
bespoke `length` accessor in `function/mod.rs` and is excluded. A sealed
helper trait carrying the wrapper's item type is the first rung to try.

### 2. `PartialEq` — two semantic arms

The wrapper `PartialEq` bodies fall into two classes:

```rust
// array / object / function — reference identity
fn eq(&self, other: &Self) -> bool { self.0.ptr_eq(&other.0) }
// string / bigint — structural
fn eq(&self, other: &Self) -> bool { self.0.items_eq(&other.0) }
```

(each type's `partial_eq.rs`). The two classes are the variant choice a sealed
helper trait would carry. `BigInt` additionally implements `Eq`
(`bigint/partial_eq.rs`), so the structural arm must allow that.

### 3. `ordinary_to_primitive` — plain function dedup (no macro)

`vm/primitive_coercion.rs` has three structurally identical functions —
`obj_to_primitive`, `arr_to_primitive`, `fn_to_primitive` — differing only in
the operand type and which `*_to_string` helper the `None` branch uses.
`value_of` is already generic over `T`,
so only the to-string side needs threading:

```rust
fn ordinary_to_primitive<A: IVm, T: Clone>(
    v: T,
    preferred: ToPrimitivePreferredType,
    to_string: impl FnOnce(T) -> Option<Result<Primitive<A>, Any<A>>>,
) -> Result<Primitive<A>, Any<A>> { /* shared number/string-first dispatch */ }
```

`FnOnce`, not `Fn`: each branch calls `to_string` at most once, so the
weaker bound admits every caller. The three public functions become
one-line wrappers passing `obj_to_string` / `arr_to_string` /
`fn_to_string`. This is the lowest-risk item — no macro, just a generic
helper — and the timing matters more than the size: when user-defined
`valueOf`/`toString` lands (the `TODO`s in `value_of` and the three
`*_to_string` helpers of `primitive_coercion.rs`), the spec's
method-ordering rule must otherwise change in three places in lockstep, and
a divergence is a silent spec bug for one reference type only.

The three `Dispatch` arms calling these (`object`, `array` and `function` of
`PrimitiveCoercionOp`) also each re-spell
`self.0.unwrap_or(ToPrimitivePreferredType::Number)` with the same
spec-reference comment; hoist that default into one accessor on
`PrimitiveCoercionOp` in the same change.

### 4. `IntoIterator`, `Default`, and the `ToX` constructor traits — same axis, missing from the inventory

Three more trait families follow the exact "one impl per nominal newtype,
byte-identical modulo names" shape and must ride whatever mechanism items
1–2 land, or they stay a lockstep-edit hazard when a wrapper/variant is
added:

```rust
// vm/impls/into_iterator.rs — three impls differing only in `Item`
impl<A: IVm> IntoIterator for Array<A>  { type Item = Any<A>;      /* self.index_iter() */ }
impl<A: IVm> IntoIterator for Object<A> { type Item = Property<A>; /* self.index_iter() */ }
impl<A: IVm> IntoIterator for String<A> { type Item = u16;         /* self.index_iter() */ }

// vm/impls/default.rs — three impls differing only in the constructor
impl<A: IVm> Default for Array<A>  { fn default() -> Self { empty().to_array() } }
impl<A: IVm> Default for Object<A> { fn default() -> Self { empty().to_object() } }
impl<A: IVm> Default for String<A> { fn default() -> Self { empty().to_string() } }
```

and the constructor traits themselves — `ToObject` (`vm/object/to_object.rs`),
`ToArray` (`vm/array/to_array.rs`), `ToString` (`vm/string/to_string.rs`)
— are the same blanket-trait skeleton modulo wrapper/internal/item type
(`ToString` additionally carries a `try_` variant).

Since the `into_iter`/`default` bodies are already trait-method
delegations, a sealed helper trait carrying `Internal`/`Item` (the same
source-of-truth-table axis as items 1–2) centralizes the knowledge — but
**not through a blanket impl**: `IntoIterator` and `Default` are foreign
traits, and Rust's orphan rules reject `impl<A: IVm, W: Sealed> Default
for W` (the self type is an uncovered type parameter, E0210), so "zero
hand-written impls" is not reachable on this route. The honest floor is
one concrete one-line impl per wrapper delegating to the sealed trait —
each `Array<A>`/`Object<A>`/`String<A>` self type is local, so those are
fine — or rung 2 of the `nanvm-lib/AGENTS.md` ladder (`build.rs` from the
shared table), or accepting the duplication (rung 3).

### Notes

- All items are pure boilerplate collapse; behavior is unchanged, so
  `cargo test` / `cargo clippy` / `cargo fmt --check` should pass without
  edits to call sites.
- Already-correct abstractions to leave alone: `IContainer` defaults,
  `ContainerFmt`, the bigint `abs_*_vec` helpers, and the `Dispatch` visitor
  (`vm/dispatch.rs`).
- The hand-written primitive-coercion dispatch matches are filed separately
  as [primitive-coercion-dispatch](./primitive-coercion-dispatch.md) — they
  are plain-code fixes, independent of the trait-boilerplate mechanism here.

### Related

- `i81`, `i33` (both retired, both shipped) — concrete `Any<T>` / wrapper-type
  design; this cleanup is consistent with moving operations onto wrappers.
  `i33` asked for `Any` as a wrapper struct so operators could be implemented on
  it; `i81` generalized that to the whole family. Both landed in
  [`nanvm-lib/src/vm/`](../src/vm/mod.rs): `pub struct Any<A: IVm>(A)` in
  `src/vm/any/mod.rs`, with `Array`, `Object`, `String`, `BigInt` and
  `Function` wrappers beside it, and the operators implemented on the wrappers
  rather than on the VM traits.
- [65Y-nanvm-conversion-macros](./65y-nanvm-conversion-macros.md) — the
  `From`/`TryFrom` families on the same axis, and the no-macro constraint.
- [primitive-coercion-dispatch](./primitive-coercion-dispatch.md) — the
  coercion dispatch note previously in this file's Notes section.
