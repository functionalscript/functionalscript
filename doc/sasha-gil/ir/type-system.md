# Code IR: a safe typed low-level language

**Proposed** on 2026-11-11, from the owner's framing that the IR has two
purposes: it is the code generator's IR, and it is a typed low-level
language in which L0, NaNVM's logic and other runtime parts are written by
hand. This note is stashed for review. Nothing here is decided yet, and
[ir-design.md](./ir-design.md) is unchanged until it is.

## Summary

One language serves both purposes. Code generated from prepared FAST and
runtime code written by hand, such as L0 and NaNVM, use the same types,
checker, lifetime pass and emitters. The only difference is which types a
module can see inside: a program sees `any` as abstract, and the Any module
sees its bits.

- **Types are sets of values.** Integers are ranges, `int(0n, 255n)`, so 8,
  16, 32 and 64 bits are just common cases. `u(6)`, `u(48)` and
  `int(1n, 8n)` are as cheap to write. Subtyping is the subset relation.
- **Layout is separate from type.** A sum type is a tagged union for the
  checker. Where it lives is a second, optional declaration: tag and
  payload locals by default, or exact bit patterns over an `i64`. The NaN
  box is a sum with declared bits, written in the notation of
  [Sergey's NaN VM README](../../sergey-shandar/nanvm/README.md).
- **Safety is by construction.** A payload is read only inside the `match`
  arm that tested its tag. A NaN payload cannot become a pointer, an
  integer cannot overflow silently, and a counted reference cannot be used
  after it is freed. The only failure at run time is a trap at a named
  point.
- **Ownership comes from types, not from code.** A type holding a counted
  reference is linear. `dup`, `drop` and `release` are derived from the
  type, and one lifetime pass places them in all code, hand-written or
  generated.
- **The host language is the meta-language.** Generics, macros and
  repeated layouts are FunctionalScript functions that build IR data. The
  IR core stays first-order and monomorphic, which is what emitters want.

## Principles

1. **Safe means no undefined behavior.** A checked module either returns a
   value or traps at a named point. It never reads a variant it did not
   test, forges a reference, frees a value twice or reads past an array's
   end. A leak is possible only after a throw, and the host's `recover`
   already cleans that up
   ([L0 design §21](../wasm/l0-design.md#21-the-host-is-an-l0-client)).
2. **Minimal: a few type formers, and everything else defined from them.**
   `bool`, `unit`, `never`, `option(T)` and `u8` to `u64` are definitions
   in a prelude, not built-ins.
3. **Orthogonal: type, layout and ownership are three separate
   questions.** Changing the layout of `any` changes no function that uses
   it, and its ownership follows from its fields.
4. **Exact: an operation means its mathematical result.** Adding two
   `u(32)` values gives `int(0n, 2n ** 33n - 2n)`. Wrapping, narrowing and
   rounding are operations you write, never side effects of a width.
5. **Declarative: what can be derived is derived.** Tag tests, field
   reads, constructors, `dup`, `drop`, equality and the signedness of each
   WASM instruction come from declarations
   ([DESIGN.md §5](../../DESIGN.md#5-declarative-over-imperative)).
6. **One source of truth.** L0 is written once, in the IR, then emitted as
   WASM and as Rust and proved against the L0 view and the parity tables
   ([DESIGN.md §13](../../DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).

## Types

There are eight type formers, and every other type is a definition. A
module can also export a type without its definition
([Two purposes, one language](#two-purposes-one-language)).

| Former | Its values | In the eDSL | Notes |
| --- | --- | --- | --- |
| Integer range | the integers from `a` to `b` | `int(a, b)`, `u(n)`, `i(n)` | at most 64 bits wide; signedness is derived from the range |
| Float | IEEE 754 doubles | `f64`, `f64c` | `f64c` holds one NaN, the canonical one |
| Product | one value per field | `{ len: u(4), unit: u16 }`, `array(T, n)` | immutable |
| Sum | one tagged variant | `sum({ none: unit, some: T })` | `T.only('a', 'b')` keeps some variants |
| Heap object | a record in the heap, with an optional tail array | `object({ len: u(31), units: tail(u16, 'len') })` | reached only through a reference |
| Reference | a pointer to a heap object | `ref(O)`, `uniq(O)`, `stat(O)` | counted, unique or immortal |
| Code | a pointer to a top-level function | `code([any, any], any)` | for indirect calls and closures |
| Brand | a copy of a type under a new name | `brand('Unit', u16)` | free at run time, never converted implicitly |

The prelude defines the rest:

```js
const unit = {}
const never = sum({})
const bool = sum({ false: unit, true: unit })
const option = T => sum({ none: unit, some: T })
const u8 = u(8)   // int(0n, 255n)
const i32 = i(32) // int(-(2n ** 31n), 2n ** 31n - 1n)
```

Brands fix a weakness of today's IR, where `i32` means an index, a length,
a kind tag, a code index or a builder. With brands each is its own type,
and mixing them up is a type error.

### Subtyping is the subset relation

- `int(a, b)` is a subtype of `int(c, d)` when `c <= a` and `b <= d`. The
  widening is implicit, and the emitter may extend the carrier.
- `S.only(x)` is a subtype of `S.only(y)` when the variants `x` are among
  `y`. A subset keeps the parent's tags and layout, so it costs nothing.
- `never` is a subtype of every type.
- Products, arrays and references are invariant in a first version.

### Flow refinement narrows types in branches

- A `match` arm sees its variant's payload, and an `else` arm sees the sum
  of the variants left.
- A comparison narrows an integer in each branch. After `lt(i, 8n)` on
  `i: u(31)`, the true branch has `i: int(0n, 7n)`.
- `narrow(T, e)` checks at run time and traps. `try_narrow(T, e)` returns
  `option(T)` instead.

### Integer arithmetic is exact

- Result types come from interval arithmetic: `add`, `sub`, `mul`, `min`,
  `max`, the bitwise operations on non-negative ranges, and shifts by an
  amount below the width.
- `div` and `rem` need a divisor whose range excludes 0. After `ne(d, 0n)`
  on an unsigned `d`, the true branch has `d: int(1n, …)`, so the division
  needs no trap.
- A result wider than 64 bits is a type error. The fixes are explicit:
  `wrap(u(64), e)` reduces modulo 2^64, and `add_carry` and `mul_wide`
  return two words, as bigint code needs anyway.
- The emitter picks signed or unsigned WASM instructions, such as
  `i32.lt_s` or `i32.lt_u`, from the operands' ranges.

### Floats

- Float arithmetic gives `f64`. `canon(x)` replaces any NaN by the
  canonical one and returns `f64c`, which is a subtype of `f64`.
- An integer converts to `f64` exactly when its range is within ±2^53, and
  otherwise only through an explicit rounding operation.
- A float converts to an integer through `try_trunc(T, x)`, which returns
  `option(T)`.

## Layout

A sum or a product can declare its exact bits over a carrier. The checker
proves the declaration sound and derives every operation on it. Without a
declaration, a sum lives as a tag and payload: separate locals in WASM, an
`enum` in Rust.

### The notation is the NaN VM README's

- `0` and `1` are fixed bits, `_` is a separator, and a letter is a bit of
  the field with that name.
- `…` repeats the character before it. A field's width comes from its
  type, so at most one fill of fixed bits is left to the checker to count.
- A variant of type `f64c` takes the float's own bits.
- A nested object is a group of variants. Groups give the public kinds,
  such as `string`, and their members are the encodings.

```js
export const any = bits(64, {
    number: f64c,
    boolean: ['b111_1111_1111_0…0_0001_0000', { b: bool }],
    undefined: '0111_1111_1111_0…0_0010_0000',
    null: '0111_1111_1111_0…0_0011_0000',
    string: {
        empty: '0111_1111_1111_0…0_0000_1000',
        short: {
            s3x16: ['0111_1111_1111_u…u_0100', { u: array(u16, 3) }],
            s8x6: ['0111_1111_1111_u…u_1100', { u: array(u(6), 8) }],
            s7x7: ['1111_1111_1111_u…u_100', { u: array(u(7), 7) }],
            // 1x16, 2x16 and 4x7 to 6x7 as in the README's table
        },
        long: {
            heap: ['0111_1111_1111_0100_p…p_10', { p: ref(StrObj) }],
            lit: ['1111_1111_1111_0100_p…p_10', { p: stat(StrObj) }],
        },
    },
    // bigint, array, object and function in the same way
})
```

### What the checker proves

- Each pattern is 64 bits long, and each field is exactly as wide as its
  type. A reference field holds the pointer without its alignment bits, so
  a 4-aligned pointer of up to 48 bits fits `p…p`.
- The variants are pairwise disjoint, including the bits of `f64c`. A
  pattern is a set of masked values, so this is a small, exact check.
- Unused patterns are allowed. Values are made only by constructors, so a
  `match` never meets one. A value from outside is read with
  `try_from_bits`, which returns an `option`.

The proof is where safety comes from. A number becomes an `any` only
through `any.number(x)`, and `x` must be an `f64c`. A NaN whose payload
looks like a pointer is the classic NaN-boxing exploit, and here it is a
type error: the code has to call `canon` first.

### What the compiler derives

- A constructor per variant, such as `any.s3x16({ u })`, made of shifts
  and ors.
- The `match`, as a decision tree of mask tests. The README's hand-written
  `typeof_` and `is_*` functions are what this tree computes, which gives
  a first proof.
- Field reads, with a shift, a mask and a sign extension for a signed
  field.
- Packed arrays. `u.at(i)` on `array(u(6), 8)` with `i: int(0n, 7n)` is a
  shift by `6 * i` and a mask.
- `dup` and `drop`. The variants with a `ref` field are the counted ones,
  so `dup` is one mask test and an increment, like the README's
  `is_dyn_ref`.
- A shared field of a group. `heap` and `lit` both have `p`, so an arm on
  `long` reads `p` as a borrowed `StrObj`, whichever encoding it was.

Packed arrays also answer the
[design to-do](../wasm/TODO_DESIGN.md#the-cpu-saving-at-cannot-index-locals-at-run-time)
about the CPU-saving `at`, which cannot index locals at run time. That
String module declares its eight units as two `bits(64)` products of four
`u16` each, the first layout the to-do suggests, and `at` becomes shifts.

### Alternatives

- **Rust's niche optimization:** the compiler chooses the bits, so a
  layout cannot follow an ABI or the README.
- **Hand-written masks, as in NaNVM today:** every test is code, and
  nothing proves the patterns disjoint.
- **Packed structs, as in Zig or C:** they cover products, not checked
  sums.
- **Why the pick:** it is explicit, checked and derived, like the bitdata
  of the Habit language (Diatchki and Jones, "High-level views on
  low-level representations", ICFP 2005; cited from memory).

## Ownership and memory

A type is copyable unless it holds a counted or unique reference, and
then it is linear. Parameters borrow by default, while results and locals
own. One lifetime pass places `dup` and `drop` in every function, and the
checker verifies the result.

### Copy and linear types

- **Copy:** integers, floats, `stat(O)`, `code(…)`, and products, sums and
  brands built only from copy types.
- **Linear:** any type that holds a `ref(O)` or a `uniq(O)`. `any` is
  linear because two of its variants hold a `ref`.
- A linear value is consumed exactly once on every path: by a call that
  owns it, by a constructor, or by its derived `drop`.

### Parameter modes, and borrows without lifetimes

- `borrow` is the default. The callee only reads, and the caller keeps the
  value, as with L0's borrowed arguments.
- `own` means the callee consumes the value. Results are always owned.
- A borrowed local names its source. The `p` of an arm on a borrowed `any`
  is one. It cannot be stored in an object or returned, and its source
  stays alive until its last use.

That last rule is the one [modular-runtime.md](../wasm/modular-runtime.md)
gives an unpacked string, stated once for every type. There is no lifetime
syntax: a borrow lives as long as its source does in the same function.
Lean 4, Swift and Hylo pass parameters this way; this IR adds borrowed
locals for unpacking.

### Heap objects are immutable once shared

- An object type is a record with an optional tail array, whose length is
  one of its fields: `object({ len: u(31), units: tail(u16, 'len') })`.
  The count header is implicit, and no code reads it.
- `alloc(O, fields)` returns a `uniq(O)`, the only kind of reference that
  allows mutation. `set` and `push` take an owned `uniq` and return it, so
  mutation is threading a unique value, and the emitter writes in place.
- `freeze(u)` turns a `uniq(O)` into a `ref(O)` with a count of one, and
  the object is immutable from then on. L0's builders and `seal`
  ([L0 design §22](../wasm/l0-design.md#22-building-in-one-pass)) are this
  pair.
- A `stat(O)` object is made at compile time, such as a literal, and lives
  in a data segment. Copying it is free, and dropping it does nothing.
  This is the README's `s` bit.
- A read of a tail item is checked against the length field and traps past
  it.

### Release is derived

When a `drop` takes a count to zero, a derived `release` drops each linear
field and tail item, then frees the object. These are
[modular-l0.md](../wasm/modular-l0.md#7-modules-meet-through-a-runtime-internal-interface)'s
`release` hooks, generated instead of written. The derived `release` must
not recurse, because a deep array would overflow the stack (NaNVM's
[deep-value-drop](../../../nanvm/lib/todo/deep-value-drop.md) to-do). It
keeps a work list in the freed objects themselves.

### The floor has no raw pointers

- The language has no pointers, loads or stores. The allocator belongs to
  each target: Rust's standard allocator, and in WASM a small allocator
  that the WASM target provides.
- L0's byte functions, such as `make_string(ptr, len)`, read the program's
  scratch space. In the IR they take a `buffer`, a bounds-checked view of
  that space, instead of a pointer.
- The alternative is a `raw` capability for one module, like Rust's
  `unsafe`, so that the WASM allocator is written in the IR too. That is an
  [open question](#open-questions) below.

### Alternatives

- **Rust's lifetimes and borrow checker:** general, but it needs lifetime
  syntax in a language where most code is generated.
- **Explicit `dup` and `drop` in runtime code:** that is what NaNVM writes
  by hand today. One pass does it once, and the validator checks it.
- **A tracing collector:** baseline WASM 2.0 has none without WasmGC, and
  L0 already chose reference counting
  ([L0 design §10](../wasm/l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results)).

## Functions, control flow, effects and traps

Functions are first-order and typed, and control flow is structured.
`match` is the only branching construct, and loops carry their state as
parameters, so no local is ever reassigned.

- **Functions.** `fn(params, result, body)` declares typed parameters with
  modes and a result type. Functions are top level. The lowering makes
  closures from a `code` value and a frame
  ([L0 design §12](../wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text)).
- **Indirect calls.** A `code(params, result)` value is called with
  `call_ref`: `call_indirect` in WASM and a function pointer in Rust. The
  type already guarantees the signature, so WASM's run-time signature
  check never fails.
- **One branch construct.** `if_(c, a, b)` is a `match` on `bool`. A
  `match` covers every variant of its operand's type, or ends with an
  `else` arm. An arm on a group, such as `string`, covers all its members.
- **Blocks and exits.** `block` with a label, `br(label, value)` and
  `return_` stay as in
  [IR design choice 7](./ir-design.md#7-control-flow-mirrors-wasm-and-rust-follows-by-label-kind).
- **Loops with parameters.** `loop_({ i: u(31).of(0n) }, ({ i }, next) => …)`
  repeats when the body calls `next({ i: add(i, 1n) })`, and leaves with
  the value it falls through to. Loop parameters replace `var_` and `set`,
  so every local is assigned once and the IR is in SSA form by
  construction.
- **Traps.** `trap('l0.unit: index out of range')` has type `never`. Its
  reason follows the L0 view's convention. WASM spells it `unreachable`,
  with the reason in a side table, and Rust spells it `panic!`.
- **Throws.** `throw_(v)` is L0's throw, which stores the value and traps
  (option D, [L0 design §13](../wasm/l0-design.md#13-errors-a-throw-traps)).
- **Effects.** Each function is `pure`, `traps`, `allocates` or `throws`,
  as in [IR design choice 5](./ir-design.md#5-a-row-says-what-a-call-may-do).
  Imports declare it, and the checker infers it for functions written in
  the IR.

Exact ranges keep loops honest without overflow checks. A counter
`i: u(31)` compared with a bound `n: u(31)` has
`i: int(0n, 2n ** 31n - 2n)` inside the loop, so `add(i, 1n)` still fits
`u(31)` and needs no check. A counter that is incremented without a
comparison is a type error, which is the bug it would be.

## Two purposes, one language

The two purposes differ in who writes the code and which types it can see,
not in the language. Module abstraction draws that line, and everything
else is shared.

| | Program code | Runtime code |
| --- | --- | --- |
| Written by | the lowering, from prepared FAST | people, in the eDSL |
| Sees `any` as | sealed: its public variants only | its bits and encodings |
| Heap objects | none; it calls L0 functions | its own module's `ref`, `uniq` and `stat` objects |
| Lifetimes | the lifetime pass | the same pass |
| Generics | not needed | host functions |
| Checked and emitted by | one checker, one set of emitters | the same |

```text
program code                        runtime modules
lowered from prepared FAST          written by hand in the eDSL:
sees `any` sealed  <── sealed ───   Any, String, BigInt,
                       types        Containers, Functions
        │                                   │
        └─────────────────┬─────────────────┘
                          ▼
   checker: types, layouts, linearity, exhaustive matches ──> interpreter
                          │                                   (reference semantics)
                          ▼
     lifetime pass: dup and drop for every linear type
                ┌─────────┴─────────┐
                ▼                   ▼
          WASM emitter         Rust emitter
```

The two kinds of code meet only through sealed types. From the checker
down, nothing depends on who wrote a function.

### A module can seal a type

- A module can export a type with its name and public variants but
  without its layout or encodings. The Any module exports `any` this way.
  A program can match on `string` or `number`, but not on `s8x6`.
- The public variants are the top-level groups of the layout. For `any`
  they are the nine kinds of L0's kind tags.
- Inside its module, a sealed type is its definition. Sealing costs
  nothing at run time. It only limits which constructors and arms other
  modules can write.

### Program code uses refined `any`

- What the lowering knows about a value becomes its type. After
  `toNumeric`, a value is `any.only('number', 'bigint')`, so the closure
  rule of [L1 design §2](../wasm/l1-design.md#2-the-closure-rule) is
  ordinary typing.
- Reading the number out of an `any.only('number')` is total and cannot
  trap. `kind` is a `match`.
- The split of `length` by module in
  [modular-l0.md](../wasm/modular-l0.md#2-length-splits-into-one-function-per-module)
  needs the set of kinds a value may have. That set is now the variants in
  its type, which answers that note's first "least sure" point.
- A String function takes `any.only('string')`, so passing a non-string
  is a type error. This answers the
  [design to-do](../wasm/TODO_DESIGN.md#the-precondition-of-unpack) on the
  precondition of `unpack`.

### Runtime modules are ordinary IR modules

- Any, String, BigInt, Containers and Functions from
  [modular-l0.md](../wasm/modular-l0.md) are IR modules. Each owns its
  kinds' encodings and heap objects, and its exports are its part of L0.
- The unpacked string of
  [IR choice 13](./ir-design.md#13-an-unpacked-string-is-an-ir-type-laid-out-by-the-runtime-module)
  is a type the String module exports. Its slots are the locals the
  emitter gives that type's layout, so a manifest's slot list is derived.
  BigInt, and any later module, follows the same rule, which closes the
  to-do
  ["one rule for BigInt and later types"](../wasm/TODO_DESIGN.md#one-rule-for-bigint-and-later-types).
- Template form and import form become a choice made when linking. In
  template form, the module's IR is compiled into the program and inlined.
  In import form, it is compiled into the runtime, and the program imports
  its functions. One IR body serves both forms and both targets, so
  modular-l0.md's "one template per target" goes away.
- A function that allocates can be a template too, because `alloc`
  becomes an import of the runtime's heap. That relaxes a rule in
  [modular-l0.md's summary](../wasm/modular-l0.md#summary), and needs the
  owner's view.

## Surface syntax

The eDSL is FunctionalScript. Binders take their names from object keys,
so hand-written code reads like ordinary functions and still becomes the
named data form of
[IR choice 6](./ir-design.md#6-locals-have-names-and-only-loop-state-is-mutable).

- **Binders from keys.** In `fn({ a: any, b: any }, any, ({ a, b }) => …)`,
  the keys name the parameters and the destructured variables are what the
  body uses. A misspelled variable is a JavaScript error, and the printed
  IR still says `a` and `b`. The eDSL calls the arrow function once, with
  `get` nodes, so the IR holds no functions and stays printable,
  comparable and hashable.
- **Local bindings.** `let_({ x: e1, y: e2 }, ({ x, y }) => body)`.
- **Matches.** `match_(v, { number: n => …, string: s => …, else: rest => … })`
  has one arm per variant name. An arm can destructure its payload's
  fields: `s3x16: ({ u }) => …`.
- **Loops.** `loop_({ i: u(31).of(0n) }, ({ i }, next) => …)`. A loop
  parameter declares its type with `T.of(start)`, because a range cannot
  be inferred from the first value.
- **Literals mean their value, and the expected type picks the
  representation.** `5n` is a `u(8)` where a `u(8)` is expected, a bigint
  `any` where an `any` is expected, and `int(5n, 5n)` otherwise. `1.5`,
  `true` and `'abc'` work the same way. This keeps
  [IR choice 3](./ir-design.md#3-a-javascript-primitive-is-its-own-constant)
  and drops its `i32(3)`.
- **Generics are host functions.** `option` above is one, and a function
  generic in a type is `T => fn(…)`. The eDSL builds one monomorphic copy
  per type and names it after its arguments. Repeated layouts work the
  same way: the README's four 7-bit short strings come from one function
  of the count.
- **One name per operation.** `add`, `sub`, `mul`, `div`, `rem`, `and`,
  `or`, `xor`, `shl`, `shr`, `eq`, `lt` and `le` are typed by their
  operands, along with `wrap`, `narrow`, `try_narrow` and `canon`. The
  `prim` table's rows become typing rules, one per operation, instead of
  `f64_sub` and `i32_add`.
- **Normalized form.** The constructors build tuples declared as an RTTI
  schema
  ([IR choice 12](./ir-design.md#12-the-normalized-form-is-an-rtti-schema)),
  and types are data too, such as `['int', 0n, 255n]`. RTTI's canonical
  form already has `subset`, the relation that subtyping uses here.
- **Printer.** It prints the normalized form back as eDSL text, so
  generated and hand-written code read the same way in a review.

This is multi-stage programming, as in Terra, where Lua builds typed
low-level code, or Zig's `comptime`. FunctionalScript is the first stage,
and the IR is the second.

## Worked example: two String functions over the NaN box

The memory-saving String module needs no slots: it decodes the `any` on
each read. Over the `any` from the [Layout](#layout) section, its `length`
and `at` are:

```js
const str = any.only('string')

// The number of UTF-16 code units.
export const length = fn({ s: str }, u(31), ({ s }) =>
    match_(s, {
        empty: () => 0n,
        short: {
            s3x16: () => 3n,
            s8x6: () => 8n,
            s7x7: () => 7n,
            // … one arm per short encoding
        },
        long: ({ p }) => p.len,
    }))

// The code unit at index i, or a trap past the end.
export const at = fn({ s: str, i: u(31) }, u16, ({ s, i }) =>
    match_(s, {
        empty: () => trap('l0.unit: index out of range'),
        short: {
            s3x16: ({ u }) => u.at(narrow(int(0n, 2n), i)),
            s8x6: ({ u }) => sixBit.at(u.at(narrow(int(0n, 7n), i))),
            s7x7: ({ u }) => u.at(narrow(int(0n, 6n), i)),
            // …
        },
        long: ({ p }) => p.units.at(i),
    }))
```

What the types do here:

- **No arm can read the wrong payload.** `u` exists only in its own
  encoding's arm, with its own width.
- **Index checks are where they must be, and nowhere else.** `narrow`
  traps for an index past a short string. `sixBit` is a constant table of
  64 code units, and a `u(6)` always indexes it, so that read has no check
  at all. `p.units.at(i)` is checked against `p.len`.
- **Widening is implicit.** A `u(7)` unit is returned as a `u16` with no
  conversion written.
- **No `dup` or `drop` appears.** `s` is borrowed, and `p` borrows from
  `s`.
- **One arm serves two encodings.** `long` reads `p` from `heap` or `lit`,
  the field they share.

The Any module writes no `dup` either. The five counted variants, one per
kind with storage, differ only in their `tttt` bits, so the derived test
merges into one mask, the README's `is_dyn_ref`:

```wat
local.get $v
i64.const 0xFFF0_0000_0000_0003
i64.and
i64.const 0x7FF0_0000_0000_0002
i64.eq
if ;; a counted reference: increment its count
```

For brevity, the string encodings above are written inside `any`. In the
modular runtime they belong to the String module. Any would declare which
bits a short string may use, and String the encodings inside them, with
the checker reading both to prove them disjoint.

## Emitting WASM and Rust from the same module

Each type has a carrier on each target, and each construct has one
spelling rule. The emitter stays a total function from a checked module,
as in
[IR choice 11](./ir-design.md#11-a-target-is-a-total-emitter-spelling-rows-by-rule).

| IR | WASM | Rust |
| --- | --- | --- |
| `int(a, b)` | an `i32` or `i64` local, the narrower that holds the range | the narrowest of `u8` to `u64` or `i8` to `i64` |
| `add` on ranges | computed in the result's carrier, `_s` or `_u` by range | `+` on the result's type, which cannot overflow |
| `f64`, `f64c` | `f64` | `f64` |
| `bool` | `i32` | `bool` |
| product | one local per field, multi-value results | a `struct` or tuple |
| sum, default layout | a tag local plus payload locals, shared by carrier | an `enum` |
| sum, declared bits | one `i64` local; tests are `and` and `eq`, fields are shifts | a `#[repr(transparent)]` struct over `u64` with derived methods |
| packed array | shifts by index times width | the same shifts |
| `ref(O)`, `uniq(O)` | an `i32` pointer into the heap, count in a header | a pointer from `Rc::into_raw` or `Box::into_raw` |
| `stat(O)` | a pointer into a data segment | a `&'static` reference |
| `code(…)` | a table index, called with `call_indirect` | a function pointer |
| `match` | `br_table` on a tag, or mask tests on bits | `match`, or `if` chains on bits |
| `loop_` with parameters | `loop` with its parameters as locals | `loop` over `let mut` bindings |
| `trap(reason)` | `unreachable`, the reason in a side table | `panic!(reason)` |

The Rust column looks like the `unsafe` code in NaNVM's
[`nanenum.rs`](../../../nanvm/lib/src/nanenum.rs), which packs an `Rc` into
a `u64` by hand. The emitter writes that same code, and the IR checker is
what proves it sound. A reader of the generated Rust sees `unsafe` blocks
whose safety argument is the layout declaration.

Two things stay target-specific: the allocator, and how a `trap` reason
reaches the host. Everything else is decided once, in the IR.

## What changes in ir-design.md

Seven of the thirteen choices change, and six stay as they are.

| Choice | Today | With this plan |
| --- | --- | --- |
| 2. Types | seven fixed types; the IR does not track kinds | eight type formers; kinds are the public variants of `any`, tracked by refinement |
| 3. Literals | `i32(3)` for integers; `5n` is a bigint `any` | `5n` is the integer 5, and the expected type picks a range or `any` |
| 4. Tables | `prim` rows per type, such as `f64_sub`; a `str` table | one typing rule per operation; `l0` and `str` become the runtime modules' exports |
| 6. Locals | named; `var_` and `set` for loop state | names from binder keys; loop parameters instead of `var_` |
| 7. Control flow | `if_` on `bool`, `block`, `loop`, `br` | `match` first, `if_` as a match on `bool`; loops with parameters |
| 10. Memory | none | typed heap objects through `ref`, `uniq` and `stat`, plus a bounds-checked `buffer`; still no raw pointers |
| 13. Unpacked strings | a hard-coded seventh type | a type the String module exports, its slots derived from its layout |

Choices 1, 5, 8, 9, 11 and 12 stay. Choice 9's lifetime pass now runs on
every linear type, not only on `any`.

The plan also answers four open items in
[TODO_DESIGN.md](../wasm/TODO_DESIGN.md) and
[modular-l0.md](../wasm/modular-l0.md#where-this-draft-is-least-sure): the
precondition of `unpack`, one rule for BigInt and later types, the
CPU-saving `at`, and the set of kinds that the split `length` needs.

## Plan

Each step is a PR or a short stack, proved before the next one starts. As
with L0, everything runs on a JavaScript host before any WASM exists.

1. **The design note.** This note, once reviewed, and the changes to
   ir-design.md that the table above lists. Nothing starts before the
   owner's approval.
2. **Types as data.** The eight formers, the prelude, subtyping, interval
   arithmetic and the carrier of each type on each target. Proofs cover
   the subset laws, the arithmetic rules and the carrier choice.
3. **Layouts.** `bits` declarations, the pattern notation, the
   disjointness check, and the derived constructors, tests, field reads,
   `dup` and `drop`. The proof is the NaN box from Sergey's README: the
   derived `kind` must equal the README's `typeof_` on every pattern.
4. **Terms and the checker.** Expressions, `match` with exhaustiveness and
   refinement, modes and linearity, borrowed locals, binders and the
   printer. Proofs run over hand-written functions: ir-design's
   `subtract`, and String's `length` and `at`.
5. **An interpreter in FunctionalScript.** It is the reference semantics,
   with bits as bigints. It runs the Any and String modules and compares
   them with the L0 view in
   [`fjs/wasm/runtime/l0`](../../../fjs/wasm/runtime/l0/module.f.js) on the
   parity tables.
6. **The lifetime pass** and the validator for the owned stage, for every
   linear type.
7. **The WASM emitter and the heap.** Allocator, counts and derived
   `release`, checked against the interpreter on the same tables.
8. **The lowering** from prepared FAST, starting with the L1 module, whose
   types the closure rule already gives.
9. **The Rust emitter.** NaNVM's L0 is emitted beside `nanvm_lib`, and
   replaces it only once it does everything that one does
   ([DESIGN.md §11](../../DESIGN.md#11-build-the-replacement-beside-the-module-it-replaces)).

Steps 2 and 3 can run in parallel, and step 5 can start as soon as step 4
checks its first function.

## Open questions

Each has a recommendation, so the plan can go ahead on it unless the owner
chooses otherwise.

1. **The floor.** Should the WASM allocator be written in the IR, with a
   `raw` capability for one module, or provided by the WASM target?
   Recommended: the target first, and `raw` later only if we want the
   allocator in the IR.
2. **Integer refinements.** One interval per type, or sets of intervals,
   as [`fjs/types/range_set`](../../../fjs/types/range_set/module.f.js)
   has? Recommended: one interval, and sets later if signed division needs
   them.
3. **Generics.** Host functions only, or type parameters in the IR itself?
   Recommended: host functions only, so the IR stays monomorphic.
4. **Loop parameters.** Do they replace `var_` and `set`? Recommended:
   yes, since every local is then assigned once.
5. **Layout notation.** README-style pattern strings, or field lists with
   bit offsets? Recommended: pattern strings, because the README already
   reads that way.
6. **Who declares the string encodings in the NaN box?** Recommended: Any
   declares the bits a short string may use, String declares the encodings
   in them, and the checker reads both.
7. **Trust at the module boundary.** Does the runtime trust an `i64` from
   a program we compiled, or check it with `try_from_bits`? Recommended:
   trust it, because only our compiler makes programs and the WASM sandbox
   bounds any damage.
8. **Templates that allocate.** May an allocating function be inlined, now
   that `alloc` is an import? Recommended: yes, which relaxes a rule in
   modular-l0.md.
9. **Where the code lives.** Recommended: `fjs/codegen/ir`, with
   `fjs/codegen/wasm` and `fjs/codegen/rust` as emitters, decided before
   step 2.
