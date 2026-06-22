# TODO

## 38. Rust: bigint: Optimize multiplication.

**Priority:** P3
**Status:** open

See https://www.youtube.com/watch?v=AMl6EJHfUWo

---

## 58. BigUint issues.

**Priority:** P3
**Status:** open

1. There is a todo in line 259 of big_uint.rs; that issue should be clarified.
2. Replace panic in BigUint::shl with returning an error code.

---

## Optimal NaNVM

**Priority:** P3
**Status:** open

https://en.wikipedia.org/wiki/Double-precision_floating-point_format
https://anniecherkaev.com/the-secret-life-of-nan
https://brionv.com/log/2018/05/17/javascript-engine-internals-nan-boxing/

### Float64 Layout

- 1 bit — sign (S)
- 11 bit — exponent (E)
- 52 bit — fraction (F)

|SE |F             |Value           |
|---|--------------|----------------|
|000|00000_00000000|+000000_00000000|
|...|              |                |
|3FF|00000_00000000|+000000_00000001|
|...|              |                |
|434|00000_00000000|+200000_00000000|
|...|              |                |
|7FF|00000_00000000|+inf            |
|...|              |NaN             |
|800|00000_00000000|-0.0            |
|...|              |                |
|BFF|00000_00000000|-000000_00000001|
|...|              |                |
|C34|00000_00000000|-200000_00000000|
|...|              |                |
|FFF|00000_00000000|-inf            |
|...|              |NaN             |

Integer range: `[-2^53; +2^53]`.

### NaN Payload

```
  0                    1                   2                   3
  0 123 4567 89AB CDEF 0123 4567 89AB CDEF 0123 4567 89AB CDEF 0123 4567 89AB CDEF
: 0 111_1111_1111 0000 0000_0000_0000_0000 0000_0000_0000_0000 0000_0000_0000_0000
```

### 5 bit string

- 26 lower case letters

50/5 = 10

### 6 bit String

64: 
- 0-9: 10
- A-Z: 26
- a-z: 26
- $_: 2

48/6 = 8

### 7 bit string

128: ASCII

49/7 = 7

// ## 8 bit string
//
// 48/8 = 6

// ## 9 bit string

// 45/5 = 9

// ## 12 bit string

// 48/4 = 12

### 16 bit string

48 / 3 = 16

### 6-bit Id String

|symbol  |code          |# |sum|
|--------|--------------|--|---|
|`$`     |`\x24`        | 1|  1|
|`0`..`9`|`\x30`..`\x39`| A|  B|
|`A`..`Z`|`\x41`..`\x5A`|1A| 25|
|`_`     |`\x5F`        | 1| 26|
|`a`..`z`|`\x61`..`\x7A`|1A| 40|

### 7FF & FFF

53 bits.

Other values:

- `NaN`
- `+Inf`: 0x7FF00000_00000000
- `-Inf`: 0xFFF00000_00000000
- pointer + null:
  - 32 bit for 32 bit platforms.
  - 48 bit for current AMD64 https://en.wikipedia.org/wiki/X86-64#Canonical_form_addresses and ARM64
    note: with alignments it can be further narrowed to 44-45 bit.
- `true`
- `false`
- `undefined`

Optimization for
- string
- bigInt

Least used letters in English: Q, J, Z and X.

#### Layout 52

Starts with `0xFFF`

|      |  |             |type       |
|------|--|-------------|-----------|
|`1111`|48|stringUInt48 |`string`   |
|`1110`|48|8 x 6 string |           |
|`1101`|48|7 x 7 stringA|           |
|`1100`|48|7 x 7 stringB|           |
|`1011`|48|6 x 8 string |           |
|`1010`|45|5 x 9 string |           |
|`1001`|48|4 x 12 string|           |
|`1000`|48|3 x 16 string|           |
|`0111`|32|2 x 16 string|           |
|`0110`|16|1 x 16 string|           |
|`0101`| 0|empty string |           |
|`0100`|48|ptr          |?          |
|`0011`| 0|undefined    |`undefined`|
|`0010`|48|bigInt48     |`bigint`   |
|`0001`| 0|bool         |`bool`     |
|`0000`| 0|-inf         |`number`   |

### Pointer Kind

Alignment 8 bytes. 3 bits.

|    |type      |               |
|----|----------|---------------|
|00.0|`object`  |object         |
|00.1|          |array          |
|01.0|`string`  |string         |
|01.1|          |               |
|10.0|`function`|function       |
|10.1|          |static function|
|11.0|`bigint`  |bigint         |
|11.1|          |               |

### Object

```rust
struct Object {
  propertySet: PropertySet
  iterable: Func<Iterator>
}

struct Array {
  length: u32,
  array: [Value; self.length],
}
```

### String

```rust
struct String {
  length: u32,
  array: [u16; self.length],
}
```

### Function

```rust
struct Function {
  pointer: FunctionBody,
  array: [Value; length],
}
```

### BigInt

```rust
struct BigInt {
  length: u32,
  array: [u64; self.length],
}
```

### Order of Object Properties

See https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys and https://262.ecma-international.org/6.0/#sec-object-type

An integer index for Node.js, Deno and Bun means a value from `0` to `4294967294` including. 4_294_967_294 = 0xFFFF_FFFE. But an integer index in the ES6 standard is +0..2^53-1.

### VM Interface

Two design options:
- using instances
- using types (required if multiple VMs must coexist in the same process)

```rust
trait Any {
}

trait String {
}

trait Bigint {
}

trait Object {
}

trait Array {
}
```

---

## 86. Operations for new VM implementation.

**Priority:** P3
**Status:** open

```rust
// not all types require to implement these traits.
trait StringCoercion {
    // link to MDN, optionally to ECMAScript
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
    fn string(self) -> String16
}
// not types required to implement.
trait NumberCoercion {
    // link to MDN, optionally to ECMAScript
    fn unary_plus(self) -> Result<f64, Any>
}
// ```
// fn some() -> Result<(), Any> {
//     let x = a.unary_plus()?;
//     // let y = (-a)? // `-` never throws so we don't need `?`.
//     let y = -a;
// }
// ```
trait Js: StringCoercion + NumberCoercion + Neg<Output = Any> {}

impl Js for Any {}
impl Js for Unpacked {}
```

---

## 87. Optimization: Reduce number of `Rc::clone()`.

**Priority:** P3
**Status:** open

- Now:
  ```rust
  type Any = Rc<AnyImpl>;
  fn add(a: Any, b: Any) -> Any;
  // alternative:
  fn add(a: &Any, b: &Any) -> Any;
  ```
- Proposal:
  ```rust
  trait AnyImpl {
      fn clone_to_any(&self) -> Any;
  }
  trait Any: Deref<AnyImpl>;
  fn add<'a>(a: &'a AnyImpl, b: &'a AnyImpl) -> Any {
      return { a: a.clone_to_any() };
  }
  let x: Any = ...;
  let y: Any = ...;
  let xy = add(*x, *y);
  let x2 = add(*x, *x);
  ```

---

## 89. Rust Unpack dispatch.

**Priority:** P3
**Status:** open

```rust
trait Unary<Tag> {
    type Result;
    fn do(self) -> Self::Result;
}

struct UnaryPlus;
impl Unary<UnaryPlus> for f64 {
    type Result = Any;
    fn do(self) -> Self::Result;
}

impl<Operation> Unary<Operation> Unpack {
    type Result = Any;
    fn do(self) -> Self::Result {
        match ... {
            Number(v) => v.do::<Operation>(),
            ...
        }
    }
}
```

---

## 131. An allocator for `nanvm` that doesn't panic.

**Priority:** P3
**Status:** open

An allocator for `nanvm` that doesn't panic. Instead, it should return `Result<T, Any>`.

---

## 159. nanvm-lib: collapse per-type wrapper trait boilerplate

**Priority:** P3
**Status:** open

The VM wrapper newtypes (`String<A>`, `Array<A>`, `Object<A>`, `BigInt<A>`,
`Function<A>`) each carry a directory of one-impl-per-file trait
implementations that are identical modulo the wrapper type and one associated
type. Rust's coherence rules block a blanket `impl` (each wrapper is a distinct
nominal newtype over a *different* `A::InternalX`), so the idiomatic dedup tool
here is a declarative macro.

The container internals are already well-abstracted — `IContainer`
(`vm/internal/icontainer.rs:30–75`) carries default `Serializable` and
structural-equality bodies, `ContainerFmt` centralizes `Debug`, and bigint
`add`/`sub` already share `abs_add_vec`/`abs_sub_vec`/`abs_cmp_vec`
(`vm/bigint/mod.rs:124–187`). The remaining repetition is in the thin
*wrapper* impls that delegate to those internals.

### 1. `Serializable`, `SizedIndex<u32>`, `Index<u32>` — one macro

These three traits are declared in lockstep across the per-type `mod.rs` files
and are byte-identical except for the wrapper and its output/associated type:

```rust
// string/serializable.rs:7  (array/object/bigint/function: identical modulo names)
impl<A: IVm> Serializable for String<A> {
    fn serialize(self, write: &mut impl Write) -> Result<()> { self.0.serialize(write) }
    fn deserialize(read: &mut impl Read) -> Result<Self> {
        A::InternalString::deserialize(read).map(Self)
    }
}

// string/sized_index.rs:6  (array/object/bigint: body verbatim identical)
impl<A: IVm> SizedIndex<u32> for String<A> {
    fn length(&self) -> u32 { self.0.items().length() as u32 }
}

// string/index.rs:5  (array/object/bigint: identical except `type Output`)
impl<A: IVm> Index<u32> for String<A> {
    type Output = u16;
    fn index(&self, index: u32) -> &Self::Output { self.0.items().index(index as usize) }
}
```

Instances: 5× `Serializable`, 4× `SizedIndex`, 4× `Index` (`Function` keeps
bespoke `length`/`name` accessors in `function/mod.rs:13–20` and is excluded
from the indexable arms). A single macro emits all three together:

```rust
macro_rules! container_traits {
    ($wrapper:ident, $internal:ident, $output:ty) => {
        impl<A: IVm> Serializable for $wrapper<A> {
            fn serialize(self, w: &mut impl Write) -> Result<()> { self.0.serialize(w) }
            fn deserialize(r: &mut impl Read) -> Result<Self> {
                A::$internal::deserialize(r).map(Self)
            }
        }
        impl<A: IVm> SizedIndex<u32> for $wrapper<A> {
            fn length(&self) -> u32 { self.0.items().length() as u32 }
        }
        impl<A: IVm> Index<u32> for $wrapper<A> {
            type Output = $output;
            fn index(&self, i: u32) -> &$output { self.0.items().index(i as usize) }
        }
    };
}
container_traits!(String, InternalString, u16);
container_traits!(Array,  InternalArray,  Any<A>);
container_traits!(Object, InternalObject, Property<A>);
container_traits!(BigInt, InternalBigInt, u64);
```

This collapses ~10 files into one macro plus a handful of one-line invocations.

### 2. `PartialEq` — two semantic arms

The wrapper `PartialEq` bodies fall into two classes:

```rust
// array / object / function — reference identity
fn eq(&self, other: &Self) -> bool { self.0.ptr_eq(&other.0) }
// string / bigint — structural
fn eq(&self, other: &Self) -> bool { self.0.items_eq(&other.0) }
```

(`array/partial_eq.rs:3`, `object/...`, `function/...`; `string/partial_eq.rs:3`,
`bigint/partial_eq.rs:3`). Two macro arms — `impl_eq_by_ptr!` and
`impl_eq_by_items!` — cover both groups. `BigInt` additionally derives `Eq`
(`bigint/partial_eq.rs:9`), so the items-arm should optionally emit `Eq`.

### 3. Primitive `Serializable` / `Le` impls

`common/serializable.rs:10–53` repeats the same forward-to-`Le` body five times
(`u8`, `u16`, `u32`, `u64`, `f64`):

```rust
impl Serializable for u16 {
    fn serialize(self, write: &mut impl Write) -> Result<()> { self.le_serialize(write) }
    fn deserialize(read: &mut impl Read) -> Result<Self> { Self::le_deserialize(read) }
}
```

A blanket `impl<T: Le>` would collide with the non-`Le` impls (`bool`, `()`,
`Sign`, tuples) under coherence, so use a macro arm
`impl_le_serializable!(u8, u16, u32, u64, f64);`. `common/le.rs:30–68` has the
parallel repetition for `u16`/`u32`/`u64`/`f64` (`to_le_bytes` /
`from_le_bytes`) and a second arm can cover those four too.

### 4. `ordinary_to_primitive` — plain function dedup (no macro)

`vm/primitive_coercion.rs` has three structurally identical functions —
`obj_to_primitive` (70–90), `arr_to_primitive` (92–112), `fn_to_primitive`
(114–134) — differing only in the operand type and which `*_to_string` helper
the `None` branch uses. `value_of` (lines 30–38) is already generic over `T`,
so only the to-string side needs threading:

```rust
fn ordinary_to_primitive<A: IVm, T: Clone>(
    v: T,
    preferred: ToPrimitivePreferredType,
    to_string: impl Fn(T) -> Option<Result<Primitive<A>, Any<A>>>,
) -> Result<Primitive<A>, Any<A>> { /* shared number/string-first dispatch */ }
```

The three public functions become one-line wrappers passing
`obj_to_string` / `arr_to_string` / `fn_to_string`. This is the lowest-risk
item — no macro, just a generic helper.

### Notes

- All four items are pure boilerplate collapse; behavior is unchanged, so
  `cargo test` / `cargo clippy` / `cargo fmt --check` should pass without
  edits to call sites.
- Already-correct abstractions to leave alone: `IContainer` defaults,
  `ContainerFmt`, the bigint `abs_*_vec` helpers, and the `Dispatch` visitor
  (`vm/dispatch.rs`). One minor inconsistency worth noting separately:
  `string_coercion.rs:24–30` re-implements the dispatch match by hand instead
  of calling `Unpacked::dispatch`.

### Related

- [i81](./README.md), [i33](./README.md) — concrete `Any<T>` / wrapper-type
  design; this cleanup is consistent with moving operations onto wrappers.

---

## 65Y-nanvm-conversion-macros. Collapse `From`/`TryFrom` wrapper impl boilerplate

**Priority:** P4
**Status:** open

### Constraint: avoid Rust macros

Per the `Avoid macro_rules!` rule in `AGENTS.md` (added in the same PR
as this issue): macros hide types from rust-analyzer, break grep and
jump-to-definition, and encourage "invisible code" that contradicts
FunctionalScript's preference for explicit, locally-readable values.
This issue is solved **without `macro_rules!`** even though declarative
macros are the idiomatic Rust answer to coherence-blocked blanket
impls.

The remainder of this issue follows the AGENTS.md ladder
(sealed trait → `build.rs` → accept duplication).

### Problem

`nanvm-lib/src/vm/impls/from.rs` and `nanvm-lib/src/vm/impls/try_from.rs`
each carry a per-VM-wrapper impl set that is byte-identical modulo a
variant name and a type argument. These are the same kind of nominal-
newtype repetition that [i159](todo.md)
addresses for `Serializable` / `SizedIndex` / `Index` / `PartialEq` /
`Le`, but the conversion traits are **not covered** there.

#### `From<X> for Unpacked<A>` — 7 copies (`from.rs:42–87`)

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

#### `TryFrom<Any<A>> for X` — 7 copies (`try_from.rs:7–85`)

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

### Options without `macro_rules!`

#### A. Status quo — keep the hand-written impls

14 copies, ~120 lines, no churn. Adding a new VM variant (`Symbol<A>`)
costs four lockstep edits (`Unpacked` enum, `from.rs`, `try_from.rs`,
`serializable.rs`); the asymmetry between `From` and `TryFrom` for the
same `(wrapper, variant)` pair is invisible at compile time and
detected only by tests.

This is the cheapest option *today*; it remains a viable answer if
none of B/C lands a clean enough improvement.

#### B. Generic helper trait + one-line impls

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

#### C. Codegen via `build.rs` from a source-of-truth table

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

#### D. FunctionalScript eDSL for Rust (longer-term)

The natural endpoint of C, if it pays off: write a small
FunctionalScript program that consumes the variant table and emits
Rust source. `fs/djs/transpiler` already turns DJS into JS; a
parallel Rust emitter would let the variant table live in
`fs/nanvm/conversions.f.ts` (or similar) as plain data, with the
emitter as the only Rust-aware piece. This is large enough that it
should be filed separately if and when there is appetite — flagging
it here only because PR feedback asked.

### Recommendation

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

### Why this still qualifies

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

### Caveats / why this is an idea, not a mechanical edit

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

### Related

- [i159](todo.md) — the same boilerplate-
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
- `AGENTS.md` — the "avoid Rust macros" guidance referenced at the
  top of this file. Documents the constraint for parallel Rust work,
  including i159.

---

## 56. Translate the Byte Code into WebAssembly or other PLs.

**Priority:** P3
**Status:** open

Translate the Byte Code into WebAssembly or other PLs, Rust/Zig/C/C++/LLVM.

---

## FS VM load/save

**Priority:** P3
**Status:** open

Sketch / document errors, exceptions, and execution scheme. The host environment has well-defined operations:

- **Load** — takes a root module path and optional extra parameters. Load-time errors are communicated to the host. A partially successful Load result may still be useful (e.g. for language server protocol scenarios).
- **Execute** — takes the successful result of Load and optional extra parameters. Calls the default export of the root module, which produces side effects. Ends on halt (normal completion, unhandled error, or external stop).
- **Save** — takes the successful result of Load. Corresponds to code/data transformations other than execution (e.g. bundling). Partially successful Save results may be useful similarly to partially successful Load results.

Open question: does a proper FS system provide user code means to handle errors, e.g. an exception handling mechanism similar to JS's?

---

