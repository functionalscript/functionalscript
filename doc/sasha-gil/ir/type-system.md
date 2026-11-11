# Code IR: a safe typed low-level language

**Proposed** on 2026-11-11, from the owner's framing that the IR has two
purposes: it is the code generator's IR, and it is a typed low-level
language in which L0, NaNVM's logic and other runtime parts are written by
hand. **Revised** the same day, after a second review of the first draft
and the [comparison round](./comparison.md).
[What the review changed](#what-the-review-changed) lists the differences.
Nothing here is decided yet, and [ir-design.md](./ir-design.md) is
unchanged until it is.

## Summary

One language serves both purposes. Code generated from prepared FAST and
runtime code written by hand, such as L0 and NaNVM, use the same types,
checker, lifetime pass and emitters. The only difference is which types a
module can see inside: a program sees `any` as abstract, and the Any module
sees its bits.

- **Types are sets of values.** Integers are ranges, `int(0n, 255n)`, so 8,
  16, 32 and 64 bits are just common cases. `u(6)`, `u(48)` and
  `int(1n, 8n)` are as cheap to write. Subtyping is the subset relation.
- **Arithmetic is exact.** Adding two `u64` values gives a `u(65)`, and
  every result of up to 128 bits has a type. Wrapping, trapping, testing
  and saturating are four ways to fit a result back, and each is a short
  definition, not a primitive.
- **Layout is separate from type.** A sum type is a tagged union for the
  checker. Where it lives is a second, optional declaration: tag and
  payload locals by default, or exact bit patterns over 64 bits. The NaN
  box is a sum with declared bits, written in the notation of
  [Sergey's NaN VM README](../../sergey-shandar/nanvm/README.md). The
  checker proves the patterns disjoint and derives every test from them.
- **Safety is by construction.** A payload is read only inside the `match`
  arm that tested its tag. A NaN payload cannot become a pointer, an
  integer cannot overflow silently, and a counted reference cannot be used
  after it is freed. The only failure at run time is a trap at a named
  point.
- **Ownership comes from types, not from code.** A type is copy, counted
  or unique by what it holds. `dup`, `drop` and `release` are derived from
  the type, and one lifetime pass places them in all code, hand-written or
  generated.
- **One language, two levels.** The high level has sums, objects and
  ownership. The low level is the same language with only integers, floats
  and memory. Each pass between them is tested by running a module before
  and after it.
- **The host language is the meta-language.** Generics, macros and
  repeated layouts are FunctionalScript functions that build IR data. The
  IR stays first-order and monomorphic, which is what emitters want.

## Principles

1. **Safe means no undefined behavior.** A checked module either returns a
   value or traps at a named point. It never reads a variant it did not
   test, forges a reference, frees a value twice or reads past an array's
   end. A leak is possible only after a throw, and the host's `recover`
   already cleans that up
   ([L0 design §21](../wasm/l0-design.md#21-the-host-is-an-l0-client)).
2. **Minimal: a few type formers, and everything else defined from them.**
   `bool`, `unit`, `never`, `option(T)` and `u8` to `u64` are definitions
   in a prelude, not built-ins. So are `wrap`, `narrow`, `clamp`, `min`
   and `max`.
3. **Orthogonal: type, layout and ownership are three separate
   questions.** Changing the layout of `any` changes no function that uses
   it, and its ownership follows from its fields.
4. **Exact: an operation means its mathematical result.** Adding two
   `u(32)` values gives `int(0n, 2n ** 33n - 2n)`. Wrapping, narrowing and
   rounding are operations you write, never side effects of a width.
5. **Every check has two forms.** `at` traps on a bad index and `try_at`
   returns an option, and `div`, `narrow` and `trunc` follow the same
   rule. Code asks for the item and branches on the answer, instead of
   computing whether an index will fit
   ([DESIGN.md §6](../../DESIGN.md#6-never-precompute-a-size-to-predict-whether-something-fits)).
   Where the types already exclude the failure, neither form checks.
6. **Declarative: what can be derived is derived.** Tag tests, field
   reads, constructors, `dup`, `drop`, `release` and the signedness of
   each WASM instruction come from declarations
   ([DESIGN.md §5](../../DESIGN.md#5-declarative-over-imperative)).
7. **One source of truth.** L0 is written once, in the IR, then emitted as
   WASM and as Rust and proved against the L0 view and the parity tables.
   Each lower form of a module is proved against the form above it by
   running both
   ([DESIGN.md §13](../../DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
8. **What is trusted is small, and it is named.** Hand-written runtime
   code and generated code are checked. The passes below the checker, the
   emitters and one low-level module are trusted, and
   [How it is checked](#how-it-is-checked) says how each is tested.

## Types

There are seven type formers, and every other type is a definition. Any
type can also be given a name ([Names](#names-do-four-jobs)).

| Former | Its values | In the eDSL | Notes |
| --- | --- | --- | --- |
| Integer range | the integers from `a` to `b` | `int(a, b)`, `u(n)`, `i(n)` | exact, up to 128 bits; signedness is derived from the range |
| Float | IEEE 754 doubles | `f64`, `f64c` | `f64c` holds one NaN, the canonical one |
| Product | one value per field | `{ len: u(4), unit: u16 }`, `array(T, n)` | immutable |
| Sum | one variant out of a tree | `sum({ none: unit, some: T })` | `T.only('a', 'b')` keeps some variants |
| Heap object | a record in the heap, with an optional tail array | `object('StrObj', { units: tail(u16, u(31)) })` | always named; reached only through a reference |
| Reference | a pointer to a heap object | `ref(O)`, `uniq(O)`, `stat(O)`, `view(O)` | counted, unique, immortal or borrowed |
| Code | a pointer to a top-level function | `code([any, any], any)` | for indirect calls and closures |

The prelude defines the rest:

```js
const unit = {}
const never = sum({})
const bool = sum({ false: unit, true: unit })
const option = T => sum({ none: unit, some: T })
const u8 = u(8)   // int(0n, 255n)
const i32 = i(32) // int(-(2n ** 31n), 2n ** 31n - 1n)
```

### Subtyping is the subset relation

- `int(a, b)` is a subtype of `int(c, d)` when `c <= a` and `b <= d`. The
  widening is implicit, and the emitter may extend the carrier.
- `S.only(x)` is a subtype of `S.only(y)` when the variants `x` are among
  `y`. A subset keeps the parent's tags and layout, so it costs nothing.
- `f64c` is a subtype of `f64`, and `stat(O)` of `view(O)`.
- `never` is a subtype of every type.
- Products, arrays and the other references are invariant in a first
  version.

### Integers are exact

- **Result types come from interval arithmetic.** `add`, `sub` and `mul`
  have the exact range of their results as their type.
- **A type holds up to 128 bits.** Every range must fit `u(128)` or
  `i(128)`, and an expression with a wider result is refused, not wrapped
  ([DESIGN.md §10](../../DESIGN.md#10-refuse-what-you-cannot-handle)). The
  limit is where the exact results of 64-bit code end: `a * b + c + d`
  over four `u64` values is at most 2^128 − 1.
- **Bitwise operations see two's complement of unbounded width**, as
  JavaScript's BigInt does. So `and`, `or` and `xor` are defined for
  negative integers too. A shift amount is in `int(0n, 127n)`, and `shr`
  rounds down.
- **Division rounds toward zero**, and `rem` takes the sign of the
  dividend, as in WASM, Rust and BigInt.
- **The carrier is the compiler's choice.** A value lives in one 32-bit
  word, one 64-bit word or two 64-bit words, the first that holds its
  range. The emitter picks signed or unsigned instructions, such as
  `i32.lt_s` or `i32.lt_u`, from the operands' ranges. A comparison of a
  `u64` with an `i64` is exact too: it is made in a carrier that holds
  both.
- **Two words are for intermediates.** `add`, `sub`, `mul`, the bitwise
  operations, shifts and comparisons take two-word operands. `div`, `rem`
  and the conversions to and from floats take one word: the operands of a
  division both fit `u64`, or both fit `i64`. WASM has no short form for
  the wide ones, so the checker refuses them on every target, and a
  module never compiles for Rust alone
  ([open question 12](#open-questions)).

### One exact operation, four fits

An exact result often has to go back into a narrower type. There are four
ways to fit it, and none is a primitive:

| Fit | A value outside `T` | Defined as |
| --- | --- | --- |
| `wrap(T, e)` | is reduced modulo 2^n | `and(e, 2^n − 1)` for `u(n)`; for `i(n)`, that and a sign extension by `xor` and `sub` |
| `narrow(T, e)` | traps | an `if_` on the bounds, with a `trap` in the other branch |
| `try_narrow(T, e)` | gives `none` | the same `if_`, returning an `option(T)` |
| `clamp(T, e)` | becomes the nearest bound | `min(max(e, lo), hi)`, and `min` and `max` are an `if_` each |

The types work out by the ordinary rules. An `and` with a mask has the
mask's range, and each branch of an `if_` sees the narrowed range
([flow refinement](#flow-refinement-is-two-rules)). Rust needs a method
per operation and policy, `wrapping_add`, `checked_add` and
`saturating_add`, and CLIF an instruction per pair, such as
`uadd_overflow_trap`. Here one `add` composes with four fits.

**What exactness costs.** For `add`, `sub`, `mul`, `and`, `or` and `xor`,
the low n bits of the result depend only on the low n bits of the
operands, and a left shift is a multiplication. So a wide intermediate
whose use fits one word costs nothing: `wrap(u64, mul(a, b))` is one
`i64.mul`. Two words are computed only where a wide value reaches a
comparison, a right shift or a local. The Rust emitter uses `u128` there,
and the WASM emitter runs a small pass first that rewrites two-word
operations into one-word ones.

Bigint code is the case that needs it. This is one step of a
multiplication over `u64` digits:

```js
// a * b + c + carry, as a low digit and a high digit
const mulStep = fn({ a: u64, b: u64, c: u64, carry: u64 }, { lo: u64, hi: u64 },
    ({ a, b, c, carry }) =>
        let_({ t: add(add(mul(a, b), c), carry) }, ({ t }) => ({
            lo: wrap(u64, t),
            hi: shr(t, 64n),
        })))
```

`t` has type `u(128)` exactly, because (2^64 − 1)^2 + 2 (2^64 − 1) is
2^128 − 1, and `shr(t, 64n)` has type `u64`. There is no carry flag and no
`mul_wide`. The code cannot drop a carry, because a dropped carry is a
type error.

### Checks come in two forms

An operation that can fail has two forms, and the rule is the same for
all of them:

| Operation | Fails when | `op` | `try_op` |
| --- | --- | --- | --- |
| `div`, `rem` | the divisor is 0 | traps | returns `none` |
| `at` | the index is not below the length | traps | returns `none` |
| `narrow` | the value is outside the type | traps | returns `none` |
| `trunc` | the float is a NaN or outside the type | traps | returns `none` |

- **Types remove checks.** Where the operand types exclude the failure,
  both forms are total and no check is emitted: `div` by an
  `int(1n, 9n)`, or `at` on an `array(T, 8)` with an `int(0n, 7n)` index.
- **Ask, do not predict.** `try_at` asks for the item and branches on the
  answer. That replaces "compute whether the index fits, then read",
  which principle 5 rules out.

### No target's corner case leaks in

Target instructions have corner cases. A signed division traps in WASM
and panics in Rust on a zero divisor and on −2^63 / −1. Rust's `%` also
panics on −2^63 % −1, where the remainder is 0 and WASM's `i64.rem_s`
returns it. A WASM shift takes its amount modulo the width of its word,
and in a Rust debug build an amount that large panics. WASM's
`i64.trunc_f64_s` traps on a NaN and on a float out of range, where
Rust's `as` saturates. None of these decides what an operation means.

- **The meaning is the exact one.** The quotient of two `i64` values has
  type `int(-(2n ** 63n), 2n ** 63n)`, one value wider than `i64`,
  because −2^63 / −1 is 2^63. The code fits it with `narrow`, `wrap` or
  `clamp`. A `u64` shifted right by 64 or more is 0.
- **The low level excludes the corner cases.** Its `div` and `rem` have
  a divisor whose type excludes 0, and operands and a quotient that
  share one word. Its shifts have an amount below the width of their
  word. A float has no range in its type, so the truncation of a float
  is the saturating one there, which WASM's `i64.trunc_sat_f64_s` and
  Rust's `as` compute alike. So each of them is total, and every target
  computes the same value for it.

[Data lowering](#emitting-wasm-and-rust-from-the-same-module) adds the
tests that the types need. A division is split on its divisor:

```js
// div(a, b) for two i64 values
if_(lt(b, 0n),
    // where b is not −1, it is at most −2
    if_(eq(b, -1n), sub(0n, a), div(a, b)),
    // where b is not 0, it is at least 1
    if_(eq(b, 0n), trap('division by zero'), div(a, b)))
```

Each `div` that is left has a quotient that fits `i64` by the ordinary
range rules. `rem` is split in the same way, with 0 in the −1 branch. A
shift whose amount can reach the width of its word gets a test of the
amount: a full shift left leaves 0 in that word, and a full shift right
gives 0, or −1 for a negative operand. A `trunc` gets the tests for a
NaN and for the bounds.

The split also shows why one interval per type is enough
([open question 2](#open-questions)). An interval cannot say "not zero"
or "not −1", but a sign test puts each of them at an end of a range,
where the next test removes it.

### Flow refinement is two rules

A local is never reassigned, because loops carry their state as
parameters. So a fact learned about a local holds wherever the local is
in scope, and two rules are enough:

1. **A `match` arm sees its part of the sum.** Inside an arm, the operand
   has the arm's type: the payload of a variant, or the subset that a
   group names. An `else` arm sees the variants that are left.
2. **A branch on a comparison narrows its operands.** In each branch of an
   `if_` on `lt`, `le`, `eq` or one of their negations, an operand that is
   a local gets the range that the other operand's range allows. After
   `lt(i, n)` with `n: u(31)`, the true branch has
   `i: int(0n, 2n ** 31n - 2n)`. Where an `eq` is false, a local loses a
   value only at an end of its range: in the false branch of
   `eq(b, 0n)`, a `b: u64` is at least 1.

The checker keeps one range per local and nothing that relates two
locals. After `lt(i, n)` it knows the range of `i`, not that `i` is below
`n`. [Open question 14](#open-questions) is about what that costs.

### Floats

- Float arithmetic gives `f64`. A NaN result's sign and payload depend on
  the target (WASM leaves them open; from memory), so `canon(x)` replaces
  any NaN by the canonical one and returns `f64c`, as L0 does
  ([L0 design §4](../wasm/l0-design.md#4-numbers-the-runtime-canonicalises-nan)).
- An integer converts to `f64c` exactly when its range is within ±2^53,
  and otherwise only through an explicit rounding operation.
- A float converts to an integer through `trunc(T, x)` or
  `try_trunc(T, x)`.
- `to_bits(x)` reads a float as a `u64`, and `from_bits(n)` reads a `u64`
  as an `f64`. Both are total, so they are ordinary operations.

### Sums are trees

- **A payload can be a sum, and such a variant is a group.** `any` has the
  group `string`, whose variants are the string encodings, some of them
  groups again.
- **Every node of the tree is a type.** `any.only('string')` is the group,
  `any.only('number', 'bigint')` is two branches, and
  `any.only('string.short')` is a group inside a group. One layout serves
  the whole tree, so a value moves between a subset and `any` at no cost.
- **A `match` has an arm per variant or per group**, in any mix. The
  checker requires that every leaf is covered once, or that an `else` arm
  covers the rest.
- **A field that all variants of a group share is read without a match.**
  Both encodings of a long string have the field `p`, so an arm on `long`
  reads `p`, whichever encoding the value has.
- **The order of the arms means nothing.** The compiler derives the
  decision tree, from the tags or from the declared bits.

### Names do four jobs

`named('Unit', u16)` is a new type with the values of `u16`. It costs
nothing at run time and is never converted implicitly. One mechanism does
four jobs:

- **A brand.** Today's IR uses `i32` for an index, a length, a kind tag, a
  code index and a builder. With names each is its own type, and mixing
  them up is a type error.
- **A seal.** A module can export a name without its definition
  ([Two purposes, one language](#two-purposes-one-language)).
- **The identity of an object type.** An object type always has a name, so
  two object types with the same fields stay apart.
- **Recursion.** A type refers to itself, or to a type declared later, by
  its name, as RTTI's data form names its recursive rules. `any` holds
  arrays, and an array holds `any` values.

## Layout

A sum or a product can declare its exact bits over a carrier. The checker
proves the declaration sound and derives every operation on it. Without a
declaration the layout is the compiler's choice: a tag and payload for a
sum, which are separate locals in WASM. A declared layout is a promise,
and the compiler never changes it.

### The notation is the NaN VM README's

- `0` and `1` are fixed bits, `_` is a separator, and a letter is a bit of
  the field with that name. A field's bits are written from the most
  significant one, and they need not be adjacent.
- `…` repeats the character before it. A field's width comes from its
  type, so at most one fill of fixed bits is left to the checker to count.
- A variant of type `f64c` takes the float's own bits.
- A nested object is a group. Groups give the public kinds, such as
  `string`, and their members are the encodings.

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
    bigint: {
        short: ['v111_1111_1111_v…v_1', { v: i(52) }],
        long: {
            heap: ['0111_1111_1111_0101_p…p_10', { p: ref(BigObj) }],
            lit: ['1111_1111_1111_0101_p…p_10', { p: stat(BigObj) }],
        },
    },
    // object and function in the same way, under the README's type tags
    // 0011 and 0110; array takes 0111, a tag that this note adds
})
```

The README gives the short bigint its pattern, `…vvv1`, and not the
meaning of its bits. The line above is this note's reading: a 52-bit
signed integer whose sign is the box's sign bit, which shows a field that
is not adjacent.

### What the checker proves

- **Width.** Each pattern is 64 bits long, and each field is exactly as
  wide as its type.
- **References fit.** A reference field holds an offset into the heap
  without its alignment bits, so a 4-aligned offset below 2^48 fits
  `p…p`. On both targets the heap is memory the runtime owns, linear
  memory on WASM and one buffer on Rust, and the Heap module keeps every
  offset in range by construction
  ([pointer-width.md](./pointer-width.md#decision)).
- **No confusion.** The variants are pairwise disjoint, including the
  bits of `f64c`. A pattern is a set of masked values, so this is a
  small, exact check.
- **Junk is allowed.** A pattern that no variant uses is junk. Values are
  made only by constructors, so a `match` never meets one. A value from
  outside is read with `try_from_bits`, which returns an `option`. It
  exists only for variants that hold no reference, because no test can
  tell a real reference from a forged one.

"Junk" and "confusion" are the terms of the Habit language's bitdata
([Alternatives](#alternatives) below).

The proof is where safety comes from. A number becomes an `any` only
through `any.number(x)`, and `x` must be an `f64c`. A NaN whose payload
looks like a pointer is the classic NaN-boxing exploit, and here it is a
type error: the code has to call `canon` first.

### What the compiler derives

- A constructor per variant, such as `any.string.short.s3x16({ u })`,
  made of shifts and ors.
- The `match`, as a decision tree of mask tests. The README's hand-written
  `typeof_` and `is_*` functions are such tests, which gives a first
  proof: the derived tree has to agree with them.
- Smaller tests, from junk. A junk pattern is a don't-care, so the
  compiler drops every bit that a test does not need to tell the
  variants apart.
- Field reads, with a shift, a mask and a sign extension for a signed
  field.
- Packed arrays. `u.at(i)` on `array(u(6), 8)` with `i: int(0n, 7n)` is a
  shift by `6 * i` and a mask.
- `dup` and `drop`. The variants with a `ref` field are the counted ones,
  so `dup` is one mask test and an increment.
- A shared field of a group. `heap` and `lit` both have `p`, so an arm on
  `long` reads `p` as a `view(StrObj)`, whichever encoding it was.

Packed arrays also answer the
[design to-do](../wasm/TODO_DESIGN.md#the-cpu-saving-at-cannot-index-locals-at-run-time)
about the CPU-saving `at`, which cannot index locals at run time. That
String module declares its eight units as two `bits(64)` products of four
`u16` each, the first layout the to-do suggests, and `at` becomes shifts.

### Layouts compose

The box above is written in one piece for brevity. In the modular runtime
it is assembled from its modules, and that needs nothing new, because a
group is a type of its own.

- **A kind's module declares its group.** String declares the `string`
  tree with its patterns and writes its functions over that type.
- **Any owns the box and hands out the slots.** The README's scalar table
  already reads this way: each row is a slot with a capacity, its "Cap."
  column, and the encoding that fills it. Any can export each slot as a
  host function from a payload pattern to a full pattern, so a module
  fills its slot and cannot write outside it.
- **The assembled runtime declares the union.** The disjointness proof
  runs there, and a collision between two modules is an error that names
  both patterns. `kind`, `dup` and `drop` are derived from the union.
  What
  [modular-l0.md](../wasm/modular-l0.md#7-modules-meet-through-a-runtime-internal-interface)
  wires by hand, `box`, `box_inline`, `payload` and the `release` hooks,
  are then the union's derived constructors, field reads and `release`.

### Alternatives

- **Rust's niche optimization:** the compiler chooses the bits, so a
  layout cannot follow an ABI or the README.
- **Hand-written masks, as in NaNVM today:** every test is code, and
  nothing proves the patterns disjoint.
- **Packed structs, as in Zig or C:** they cover products, not checked
  sums.
- **Why the pick:** it is explicit, checked and derived, like the bitdata
  of the Habit language (Diatchki, Jones and Leslie, "High-level views on
  low-level representations", ICFP 2005; cited from memory). The
  [comparison](./comparison.md#integers-signedness-sums-and-layout) found
  no IR that has it.

## Ownership and memory

Every type has one of three ownership kinds, derived from what it holds.
Parameters borrow by default and results are owned. One lifetime pass
places `dup` and `drop` in every function, and the checker verifies its
output.

### Three kinds of type

| Kind | The type holds | In code as written | The lifetime pass adds |
| --- | --- | --- | --- |
| Copy | no `ref` and no `uniq` | used freely | nothing |
| Counted | a `ref`, and no `uniq` | used freely | `dup` and `drop` |
| Unique | a `uniq` | consumed at most once on each path | `drop` |

- `any` is counted, because some of its variants hold a `ref`.
- A value is consumed when it becomes an `own` argument, a field of a new
  value, or a result.
- A unique value can be read, or lent to a call, any number of times
  before it is consumed, and never after.

### Four references

| Reference | Like Rust's | Kind | Points to |
| --- | --- | --- | --- |
| `ref(O)` | `Rc<O>` | counted | a frozen object, which may be shared |
| `uniq(O)` | `Box<O>` | unique | an object that is still being built |
| `stat(O)` | `&'static O` | copy | an object made at compile time; the README's `s` bit |
| `view(O)` | `&O` | copy, second-class | an object that something else keeps alive |

A view is how code reads an object that it does not own:

- **It is lent.** A `ref(O)` or a `uniq(O)` can be lent as a `view(O)`,
  and a `stat(O)` already is one. The `p` of an arm on `long` is a view,
  because it comes from a `ref` in one encoding and a `stat` in the
  other.
- **It has a source.** The source is the local it was lent from, such as
  the `any` whose arm it came out of. A use of a view is a use of its
  source, so the source is not dropped or consumed before the view's last
  use. A view that comes out of an `if_` or a `match` has the sources of
  every branch. There is no lifetime syntax.
- **It is second-class.** A view can be bound to a local and passed to a
  call. It cannot be stored in an object or carried by a loop parameter.
  A type that holds a view, such as an unpacked string, is second-class
  in the same way.
- **It cannot be `dup`'ed**, because its target may be static or unique.
  To keep an object, code `dup`s the value the view came from.

This is the rule that [modular-runtime.md](../wasm/modular-runtime.md)
gives an unpacked string, which always borrows its source `any`. Here it
is stated once, for every type.

### Parameter modes, and what a call returns

- `borrow` is the default. The callee only reads, and the caller keeps
  the value, as with L0's borrowed arguments. A callee that wants to keep
  a borrowed counted value `dup`s it.
- `own` means the callee consumes the value.
- A result is owned, with one exception. A result that holds a view
  borrows from the call's borrowed arguments: the callee may build it
  only from its borrowed parameters and from static data, and the caller
  treats it as a view of those arguments. That is how String's `unpack`
  returns an unpacked string. In Rust's terms, all borrowed arguments
  share one lifetime, and the result has it.
- A `match` borrows its operand, so the payloads in its arms are views
  and borrowed values. A `match` on a unique value moves the payloads
  out instead.
- A counted field or item that is read through a reference is borrowed
  in the same way. Like a view, a borrowed value has a source and is
  used only while the source lives.

Lean 4, Swift and Hylo pass parameters this way (from memory). The
[comparison](./comparison.md#memory-ownership-and-reference-counting) sets
this against Perceus, where every argument is owned.

### Heap objects are immutable once frozen

- **An object type** is a record with an optional tail array, such as
  `object('StrObj', { units: tail(u16, u(31)) })`. A tail is a length of
  the given type and that many items. The count header is implicit, and
  no code reads it.
- **What an object holds.** A field or an item has a copy or a counted
  type. An object holds no view and no `uniq`: a child object is frozen
  before it is stored, so every pointer in the heap is counted or
  static.
- **Building.** `alloc(O, fields, capacity)` returns a `uniq(O)` with an
  empty tail. `push(u, item)` appends an item and counts the length, and
  `set(u, field, value)` writes a field and drops the value it replaces.
  Both take the `uniq` and return it, so mutation is threading a unique
  value, and the emitter writes in place.
- **No uninitialized reads.** An item at or past the length cannot be
  read, and a `push` past the capacity traps.
- **Freezing.** `freeze(u)` turns a `uniq(O)` into a `ref(O)` with a
  count of one, and the object is immutable from then on. L0's builders
  and `seal`
  ([L0 design §22](../wasm/l0-design.md#22-building-in-one-pass)) are
  this pair.
- **Static objects.** A `stat(O)` object is made at compile time, such as
  a literal, and lives in a data segment. Copying it is free, and
  dropping it does nothing.
- **Later: reuse.** `try_unique(r)` consumes a `ref(O)` and returns
  `sum({ unique: uniq(O), shared: ref(O) })` by reading the count. A
  function can then update in place when it holds the only reference.
  That is Perceus's reuse, asked for by the code instead of inferred.

### The lifetime pass

The code as written, by a person or by the lowering, is the *plain*
stage. The pass turns it into the *owned* stage, where each owned value
is consumed exactly once on every path
([IR choice 9](./ir-design.md#9-lifetimes-are-one-pass-over-the-ir)).

- **`dup` and `drop`.** The pass adds a `dup` before a consuming use that
  is not the last use, and a `drop` after the last use on a path that
  does not consume.
- **Borrowed values.** A borrowed value is never dropped. It is `dup`'ed
  where it flows to a place that owns.
- **Temporaries get names.** The value of `g(a)` in `f(g(a))` is owned
  and never bound. The pass binds it, so there is something to `drop`
  after `f` returns.
- **No fixed point.** A local is never reassigned, so the last use on a
  path is found by reading the tree once. A loop borrows the locals of
  its surroundings for as long as it runs.
- **The pass is not trusted.** The checker validates the owned stage:
  one consumption per path, no use after it, and every view and borrowed
  value inside the life of its source.
- **Later: specialized drops.** A `drop` in a branch where the variant is
  known becomes that variant's code, often nothing at all.

### Release is derived

When a `drop` takes a count to zero, a derived `release` drops each
counted field and tail item, then frees the object. That is all an object
can own, because it holds no `uniq`. The `drop` of a `uniq` runs the same
`release` at once, over the items pushed so far. These are
[modular-l0.md](../wasm/modular-l0.md#7-modules-meet-through-a-runtime-internal-interface)'s
`release` hooks, generated instead of written. The derived `release` must
not recurse, because a deep array would overflow the stack (NaNVM's
[deep-value-drop](../../../nanvm/lib/todo/deep-value-drop.md) to-do). It
keeps a work list in the freed objects themselves.

The heap has no cycles, so counting frees everything
([L0 core, Lifetime](../wasm/l0-core.md#lifetime)).

### The floor: state lives in one module

The typed language has no mutable globals, pointers, loads or stores.
What needs them lives in one module, Heap, written by hand at the
[low level](#one-language-two-levels), with its state in cells of linear
memory:

- the allocator and the count header;
- the `thrown` slot of a throw
  ([L0 design §13](../wasm/l0-design.md#13-errors-a-throw-traps));
- the host's `enter`, `leave` and `recover`
  ([L0 design §21](../wasm/l0-design.md#21-the-host-is-an-l0-client)),
  which need the list of objects made since the innermost `enter`,
  builders included.

Every other module reaches the heap only through `alloc`, `push`, `set`,
`freeze`, `dup` and `drop`. The data lowering turns those into calls into
Heap and updates of the count.

- **Builders.** A builder of
  [L0 design §8](../wasm/l0-design.md#8-containers-a-builder-handle-then-seal)
  is a `uniq` object. Its `i32` handle can be the object's address, so
  threading it costs nothing.
- **Bytes.** L0's byte functions, such as `make_string(ptr, len)`, read
  the program's scratch space. In the typed language they take a
  `buffer`, a bounds-checked view of that space, instead of a pointer.
- **Constants.** A module constant of a copy type is data. A constant
  that owns a reference, such as the string `'undefined'`, is built once
  in `init` and then read as a borrow, as
  [L0 design §10](../wasm/l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results)
  reads a literal.

### Alternatives

- **Rust's lifetimes and borrow checker:** general, but it needs lifetime
  syntax in a language where most code is generated.
- **Explicit `dup` and `drop` in runtime code:** that is what NaNVM writes
  by hand today. One pass does it once, and the checker verifies it.
- **Every argument owned, as in Perceus:** more precise, but L0's ABI
  borrows its arguments, and a borrowed argument needs no count at all.
- **A tracing collector:** baseline WASM 2.0 has none without WasmGC, and
  L0 already chose reference counting
  ([L0 design §10](../wasm/l0-design.md#10-lifetime-reference-counting-borrowed-arguments-owned-results)).

## Functions, control flow and failure

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
- **One branch construct.** `if_(c, a, b)` is a `match` on `bool`.
- **Blocks and exits.** `block` with a label, `br(label, value)` and
  `return_` stay as in
  [IR choice 7](./ir-design.md#7-control-flow-mirrors-wasm-and-rust-follows-by-label-kind).
- **Loops with parameters.** `loop_({ i: u(31).of(0n) }, ({ i }, next) => …)`
  repeats when the body calls `next({ i: add(i, 1n) })`, and leaves with
  the value it falls through to. Loop parameters replace `var_` and `set`,
  so every local is assigned once and the IR is in SSA form by
  construction. They are the block parameters of CLIF and MLIR, kept in a
  tree.
- **Traps.** `trap('not an index')` has type `never`. Its reason is
  prefixed with the module and the function, `l0.unit: not an index`, as
  the L0 view does
  ([L0 design §17](../wasm/l0-design.md#17-a-functionalscript-view-of-l0)).
  The check inside `at`, `div` or `narrow` reports the same way. WASM
  spells a trap `unreachable`, with the reason in a side table, and Rust
  spells it `panic!`.
- **Throws.** `throw_(v)` is L0's throw, which stores the value and traps.
- **One effect.** A function may fail, by a trap or a throw, or it cannot.
  Imports declare the bit, and the checker infers it for functions
  written in the IR. A call that cannot fail may be moved, or removed
  when its result is unused, and two equal calls may be merged unless
  their result is unique. A call that may fail keeps its order.
  Allocation does not count as failing: running out of memory can happen
  anywhere, and a runtime may merge equal values, so making one is not
  observable
  ([L0 design §14](../wasm/l0-design.md#14-identity-same-is-reference-identity-and-a-runtime-may-merge-equal-values)).
  Passes that move calls run on the plain stage, before `dup` and `drop`
  exist.

Exact ranges keep loops honest without overflow checks. A counter
`i: u(31)` compared with a bound `n: u(31)` has
`i: int(0n, 2n ** 31n - 2n)` inside the loop, so `add(i, 1n)` still fits
`u(31)` and needs no check. A counter that is incremented without a
comparison is a type error, which is the bug it would be.

## One language, two levels

The language has a high level and a low level, and a module goes down
through three forms before it reaches a target. The same checker and the
same interpreter read all three.

```text
eDSL in FunctionalScript      elaborates literals, sugar and generics
        │
        ▼
high level, plain stage       checked: types, layouts, matches, kinds
        │  lifetime pass
        ▼
high level, owned stage       checked: each owned value consumed once
        │  data lowering
        ▼
low level                     checked: integers, floats, memory
   ┌────┴────┐
   ▼         ▼
  WASM      Rust
```

- **The low level is a subset with memory added.** It keeps integer
  ranges, floats, products and code, and adds `load` and `store` on a
  linear memory. Sums, objects and references are gone, and ownership
  stays only for a sealed imported type (below). Integers are still
  exact there, and each integer operation is one that every target
  computes exactly
  ([No target's corner case leaks in](#no-targets-corner-case-leaks-in)).
- **Data lowering does what the declarations say.** A `match` on declared
  bits becomes mask tests, a field read becomes a shift or a `load`, and
  `alloc`, `dup`, `drop` and `release` become calls into Heap and updates
  of the count.
- **The eDSL elaborates, and the checker never guesses.** Every type in
  the data form is either written or follows from the operands, so the
  checker reads a module in one pass, bottom-up. Literals, sugar such as
  `narrow`, and generics are the eDSL's work.
- **The interpreter runs every form.** So each pass is tested by running
  a module before and after it on the same inputs, and the naive form is
  never deleted
  ([DESIGN.md §13](../../DESIGN.md#13-one-source-of-truth-optimize-by-substitution)).
- **The low level is not safe by itself.** A wrong `store` corrupts the
  heap. So only two things write low-level code: the data lowering, which
  is tested as above, and the Heap module, which is small.
- **A sealed type from an imported module is not lowered.** Its carrier
  and operations are the target's. In WASM, `any` is an `i64`, a `match`
  on its public variants is a call to `kind` and a branch, and `to_f64`,
  `dup` and `drop` are imports under their L0 ABI names. In Rust it is
  the runtime's `Any`, `dup` is `clone`, and moves and borrows are
  Rust's.

The checker is ir-design's validator with more to check, and the plain
and owned stages are the ones
[IR choice 9](./ir-design.md#9-lifetimes-are-one-pass-over-the-ir)
already has.

## Two purposes, one language

The two purposes differ in who writes the code and which types it can see,
not in the language. Module abstraction draws that line, and everything
else is shared.

| | Program code | Runtime code |
| --- | --- | --- |
| Written by | the lowering, from prepared FAST | people, in the eDSL |
| Sees `any` as | sealed: its public variants only | its bits and encodings, in the module that owns them |
| Heap objects | none; it calls L0 functions | its own module's objects, through the four references |
| Lifetimes | the lifetime pass | the same pass |
| Generics | not needed | host functions |
| Checked, lowered and emitted by | one checker, one set of passes and emitters | the same |

```text
program code                        runtime modules
lowered from prepared FAST          written by hand in the eDSL:
sees `any` sealed  <── sealed ───   Any, String, BigInt,
                       types        Containers, Functions, Heap
        │                                   │
        └─────────────────┬─────────────────┘
                          ▼
        checker, lifetime pass, data lowering, emitters
```

The two kinds of code meet only through sealed types. From the checker
down, nothing depends on who wrote a function.

### A module can seal a type

- A module can export a type with its name and public variants but
  without its layout or encodings. The Any module exports `any` this way.
  A program can match on `string` or `number`, but not on `s8x6`.
- The public variants are the top of the tree. For `any` they are the
  nine kinds of L0's kind tags.
- Inside its module, a sealed type is its definition. Sealing costs
  nothing at run time. It only limits which constructors and arms other
  modules can write.
- A sealed type keeps its ownership kind. The lifetime pass knows that
  `any` is counted, and nothing else about it.
- Sealing is a rule of the checker, not of the lowering. A module in
  template form is lowered together with the program, and the lowering
  sees through the seal that the program's own code cannot.

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
  Heap is the sixth, and the only one written at the low level.
- The unpacked string of
  [IR choice 13](./ir-design.md#13-an-unpacked-string-is-an-ir-type-laid-out-by-the-runtime-module)
  is a type the String module exports. It borrows its source, as a type
  that holds a view does, and its slots are the locals that the type's
  layout takes, so a manifest's slot list is derived. BigInt, and any
  later module, follows the same rule, which closes the to-do
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
  fields, `s3x16: ({ u }) => …`, and a nested object holds the arms of a
  group.
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
  of the count. The four fits are host functions too.
- **One name per operation.** `add`, `sub`, `mul`, `div`, `rem`, `and`,
  `or`, `xor`, `shl`, `shr`, `eq`, `lt` and `le` are typed by their
  operands. The `prim` table's rows become typing rules, one per
  operation, instead of `f64_sub` and `i32_add`.
- **Normalized form.** The constructors build tuples declared as an RTTI
  schema
  ([IR choice 12](./ir-design.md#12-the-normalized-form-is-an-rtti-schema)),
  and types are data too, such as `['int', 0n, 255n]`. RTTI's canonical
  form already has `subset`, the relation that subtyping uses here.
- **Printer.** It prints the normalized form back as eDSL text, so
  generated and hand-written code read the same way in a review, and a
  test can hold the expected output of a pass as text.

This is multi-stage programming, as in Terra, where Lua builds typed
low-level code, or Zig's `comptime`. FunctionalScript is the first stage,
and the IR is the second.

## Worked examples

### Reading: two String functions over the NaN box

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
        long: ({ p }) => p.units.length,
    }))

// The code unit at index i, or a trap past the end.
export const at = fn({ s: str, i: u(31) }, u16, ({ s, i }) =>
    match_(s, {
        empty: () => trap('not an index'),
        short: {
            s3x16: ({ u }) => u.at(i),
            s8x6: ({ u }) => sixBit.at(u.at(i)),
            s7x7: ({ u }) => u.at(i),
            // …
        },
        long: ({ p }) => p.units.at(i),
    }))
```

What the types do here:

- **No arm can read the wrong payload.** `u` exists only in its own
  encoding's arm, with its own width.
- **Index checks are where they must be, and nowhere else.** `u.at(i)`
  traps for an index past a short string, and `p.units.at(i)` for one
  past the length. `sixBit` is a constant table of 64 code units, and a
  `u(6)` always indexes it, so that read has no check at all.
- **Widening is implicit.** A `u(7)` unit is returned as a `u16` with no
  conversion written.
- **No `dup` or `drop` appears.** `s` is borrowed, and `p` is a view of
  it.
- **One arm serves two encodings.** `long` reads `p` from `heap` or `lit`,
  the field they share.

### Counting: the derived `dup`

The Any module writes no `dup` either. The five counted variants, one per
kind with storage, differ only in their `tttt` bits. A test built from
the patterns alone would also compare the top bit of `tttt`, which all
five have clear. No variant uses the patterns with that bit set, so they
are junk, and the compiler drops the bit. What is left is the README's
`is_dyn_ref`, constant for constant:

```wat
local.get $v
i64.const 0xFFF0_0000_0000_0003
i64.and
i64.const 0x7FF0_0000_0000_0002
i64.eq
if ;; a counted reference: increment its count
```

### Building: two long strings joined

```js
// Appends the units of `s` to the string that is being built.
const append = fn({ d: own(uniq(StrObj)), s: view(StrObj) }, uniq(StrObj),
    ({ d, s }) =>
        loop_({ d: uniq(StrObj).of(d), i: u(31).of(0n) }, ({ d, i }, next) =>
            if_(lt(i, s.units.length),
                next({ d: push(d, s.units.at(i)), i: add(i, 1n) }),
                d)))

// Allocate once, fill, freeze.
const concat = fn({ a: view(StrObj), b: view(StrObj) }, ref(StrObj),
    ({ a, b }) =>
        let_({ n: narrow(u(31), add(a.units.length, b.units.length)) }, ({ n }) =>
            freeze(append(append(alloc(StrObj, {}, n), a), b))))
```

- **The sum of two lengths is a `u(32)`.** `narrow` is the one place where
  a string can be too long, and the code has to say so.
- **The counter needs no check.** Inside the `if_`, `i` is at most
  2^31 − 2, so `add(i, 1n)` fits `u(31)`.
- **The string is built in place.** `d` is unique, each `push` consumes
  it and returns it, and `freeze` ends the building. Nothing can read the
  object before it is frozen except through a view, and nothing can write
  it after.
- **Two checks stay that the types cannot remove:** the index check in
  `at`, which repeats the comparison above it, and the capacity check in
  `push`. [Open question 14](#open-questions) is about them.

For brevity, the string encodings are written inside `any` in these
examples. In the modular runtime they belong to the String module
([Layouts compose](#layouts-compose)).

## Emitting WASM and Rust from the same module

Data lowering turns each high-level type and operation into low-level
ones. It is the same for every target:

| High level | Low level |
| --- | --- |
| `int(a, b)`, `f64`, `f64c`, `code(…)` | themselves |
| product | itself, or one integer with shifts and masks when its bits are declared |
| sum, default layout | a tag and payload fields, shared by carrier |
| sum, declared bits | one `u64`; tests are `and` and `eq`, fields are shifts |
| packed array | shifts by index times width |
| `ref(O)`, `uniq(O)`, `stat(O)`, `view(O)` | an address, as an integer |
| field and tail reads | the bounds check, then a `load` |
| `div`, `rem`, shifts and `trunc` | the tests that the types need, then an operation that [cannot fail](#no-targets-corner-case-leaks-in) |
| `alloc`, `push`, `set`, `freeze` | calls into Heap, and `store`s |
| `dup`, `drop` | the mask test from the layout, then a `load`, an `add` and a `store` on the count, and `release` at zero |
| `match` | a branch on the tag, or mask tests on bits |
| a sealed imported type | itself: an opaque type and its imports |

Each low-level construct then has one spelling rule per target, and the
emitter stays a total function from a checked module, as in
[IR choice 11](./ir-design.md#11-a-target-is-a-total-emitter-spelling-rows-by-rule).

| Low level | WASM | Rust |
| --- | --- | --- |
| integer in one word | an `i32` or `i64` local, the narrower that holds the range | `u32`, `i32`, `u64` or `i64` |
| integer in two words | two `i64` locals, after the wide-integer pass | `u128` or `i128` |
| `add`, `div`, `shr`, `lt` and the rest | the instruction on the carrier, `_s` or `_u` by range | the operator on the carrier, which can neither overflow nor panic |
| `f64`, `f64c` | `f64` | `f64` |
| product | one local per field, multi-value results | a tuple |
| `load`, `store` | `i64.load`, `i32.store16` and the like, on linear memory | an indexed read or write of the heap buffer, in safe code ([pointer-width.md](./pointer-width.md#decision)) |
| `code(…)` | a table index, called with `call_indirect` | a function pointer |
| branch on a small integer | `br_table` | `match` |
| `loop_` with parameters | `loop` with its parameters as locals | `loop` over `let mut` bindings |
| `trap(reason)` | `unreachable`, the reason in a side table | `panic!(reason)` |
| opaque imported type | its carrier, and imports | the runtime's type, with moves and `clone` |

- **The wide-integer pass** is WASM's only, and it refuses nothing that
  reaches it. `add` and `sub` carry between the words, `mul` adds partial
  products, the bitwise operations and comparisons go word by word, and a
  shift moves bits across the words, with a branch when its amount is
  not a constant. `div`, `rem` and the float conversions never arrive
  with two words, because the checker takes them in one word only
  ([Integers are exact](#integers-are-exact)). WASM's wide-arithmetic
  proposal, with `i64.add128` and `i64.mul_wide_u` (from memory), has an
  instruction for each of the first three.
- **Rust re-checks the ranges.** If the range analysis is right, no Rust
  operator in the output can overflow or panic, and that includes `/`,
  `%` and the shifts. A debug build tests that on every run, for free.
- **Rust keeps its second check for program code.** An opaque `Any` is
  moved, borrowed and cloned in the emitted Rust, so a mistake of the
  lifetime pass is still a borrow-checker error there
  ([IR choice 9](./ir-design.md#9-lifetimes-are-one-pass-over-the-ir)).
- **Rust reaches the heap as WASM does.** The first draft made `ref(O)`
  on Rust "a pointer from `Rc::into_raw` or `Box::into_raw`", the way
  NaNVM's test-only [`nanenum.rs`](../../../nanvm/lib/src/nanenum.rs)
  packs one. Such a pointer does not fit the box on every host, so the
  owner chose
  [option A](./pointer-width.md#a-the-rust-target-gets-a-heap-region-and-stores-offsets)
  in its safe-buffer variant ([decision](./pointer-width.md#decision)):
  the heap is one buffer, a reference is an offset into it, and the
  emitted Rust reads it with indexed loads and stores. A bad offset is
  then a bounds-check panic or a wrong value in the buffer, never
  undefined behavior, and the emitter needs no `unsafe` for the heap.

Two things stay target-specific: how memory is reached, and how a `trap`
reason reaches the host. Everything else is decided once, in the IR.

## How it is checked

| Part | Trusted | Tested by |
| --- | --- | --- |
| Runtime code written by hand, and generated program code | no | the checker |
| The lifetime pass | no | the checker on the owned stage, and the counting heap |
| The checker | yes | proofs per rule, and "stuck is not a trap" |
| The layout proof | yes | the README's NaN box |
| Data lowering and the wide-integer pass | yes | running each module before and after |
| The Heap module | yes | the same runs, and the counting heap |
| The emitters | yes | WASM under Node against the interpreter; Rust's overflow checks |

- **The interpreter is the reference.** It is written in FunctionalScript,
  with bits as bigints, and runs every form of a module. The Any and
  String modules are compared with the L0 view in
  [`fjs/wasm/runtime/l0`](../../../fjs/wasm/runtime/l0/module.f.js) on the
  parity tables.
- **A counting heap.** The interpreter counts every object. After a run
  that did not throw, nothing may be left, and no count may go below
  zero. This is what Miri does for Rust, and it finds a leak or a double
  drop of the lifetime pass or of Heap.
- **Stuck is not a trap.** The interpreter fails in two ways. A `trap` is
  defined behavior. Getting stuck, such as reading a field the variant
  does not have, must never happen in a checked module. Proofs mutate
  checked modules, and every mutant the checker still accepts must run
  without getting stuck. That tests the checker itself.
- **The NaN box is the layout's proof.** The derived tests must agree
  with the README's `typeof_` and `is_*` functions on every pattern, and
  the derived `dup` test must be its `is_dyn_ref`. A prototype outside
  the repository already ran the check on 23 patterns: the README's
  scalar table, the short bigint above, and `heap` and `lit` references
  for five kinds. It found no overlap, among them or with `f64c`. Random
  values of each pattern matched that variant alone, the README's
  `typeof_` agreed, and the minimized test for a counted reference had
  `is_dyn_ref`'s two constants.
- **Golden tests in IR text.** The printer's output for each pass is held
  as text next to the proof, so a change in a pass shows in a review as a
  diff of IR.
- **An optional measurement.** Running `wasm-opt` over the output shows
  what a general optimizer still finds in it. It measures; it is never a
  step of the build
  ([comparison](./comparison.md#what-this-round-changed)).

## What changes in ir-design.md

Choices 1 and 12 stay as they are. The others change, most of them by
becoming more general.

| Choice | Today | With this plan |
| --- | --- | --- |
| 2. Types | seven fixed types; the IR does not track kinds | seven type formers and names; kinds are the public variants of `any`, tracked by refinement |
| 3. Literals | `i32(3)` for integers; `5n` is a bigint `any` | `5n` is the integer 5, and the expected type picks a range or `any` |
| 4. Tables | `prim` rows per type, such as `f64_sub`; a `str` table | one typing rule per operation; `l0` and `str` become the runtime modules' exports |
| 5. Effects | `pure`, `traps`, `allocates`, `throws` | one bit, may fail; allocation does not count |
| 6. Locals | named; `var_` and `set` for loop state | names from binder keys; loop parameters instead of `var_` |
| 7. Control flow | `if_` on `bool`, `block`, `loop`, `br` | `match` first, `if_` as a match on `bool`; loops with parameters |
| 8. Modules | functions, exports and `init` | also types, sealed or not, and constants |
| 9. Lifetimes | one pass, for `any` | the same pass for every counted and unique type; temporaries get names |
| 10. Memory | none | typed heap objects at the high level; `load` and `store` at the low level only |
| 11. Emitters | total, from the owned stage | total, from the low level |
| 13. Unpacked strings | a hard-coded seventh type | a type the String module exports, borrowing its source |

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
2. **Types as data.** The seven formers, names, the prelude, subtyping
   and interval arithmetic. Proofs cover the subset laws and the
   arithmetic rules.
3. **Layouts.** `bits` declarations, the pattern notation, the proof of
   width and disjointness, and the derived constructors, tests, field
   reads, `dup` and `drop`. The proof is the NaN box from Sergey's
   README: the derived tests must agree with its `typeof_` and `is_*`
   functions on every pattern.
4. **Terms and the checker.** Expressions, the eDSL with its binders,
   `match` with exhaustiveness and refinement, kinds, views, the printer
   and the first golden tests. Proofs run over hand-written functions:
   ir-design's `subtract`, and String's `length` and `at`.
5. **The interpreter**, for the high level, with its counting heap. It
   runs the Any and String modules against the L0 view on the parity
   tables.
6. **The lifetime pass** and the check of the owned stage, for every
   counted and unique type.
7. **Data lowering and the Heap module**, with the interpreter extended
   to the low level. Every module so far runs before and after.
8. **The WASM emitter** and the wide-integer pass, run under Node against
   the interpreter on the same tables.
9. **The lowering** from prepared FAST, starting with the L1 module, whose
   types the closure rule already gives.
10. **The Rust emitter**, over the heap buffer that
    [pointer-width.md](./pointer-width.md#decision) chose. NaNVM's L0 is
    emitted beside `nanvm_lib`, and replaces it only once it does
    everything that one does
    ([DESIGN.md §11](../../DESIGN.md#11-build-the-replacement-beside-the-module-it-replaces)).

Steps 2 and 3 can run in parallel, and step 5 can start as soon as step 4
checks its first function.

## Open questions

Each has a recommendation, so the plan can go ahead on it unless the owner
chooses otherwise. Questions 1 to 9 keep their numbers from the first
draft.

1. **The floor.** Who writes the allocator? The first draft recommended
   that each target provide it. Recommended now: the Heap module, written
   once at the low level, so that the allocator, the counts and `recover`
   are IR code that the interpreter runs. On Rust the same module serves,
   over the heap buffer that [pointer-width.md](./pointer-width.md#decision)
   chose.
2. **Integer refinements.** One interval per type, or sets of intervals,
   as [`fjs/types/range_set`](../../../fjs/types/range_set/module.f.js)
   has? Recommended: one interval. Division no longer asks for sets:
   `div` checks its own divisor, and the lowering excludes 0 and −1 on
   each side of a sign test
   ([No target's corner case leaks in](#no-targets-corner-case-leaks-in)).
3. **Generics.** Host functions only, or type parameters in the IR itself?
   Recommended: host functions only, so the IR stays monomorphic.
4. **Loop parameters.** Do they replace `var_` and `set`? Recommended:
   yes, since every local is then assigned once, and refinement depends
   on that.
5. **Layout notation.** README-style pattern strings, or field lists with
   bit offsets? Recommended: pattern strings, because the README already
   reads that way.
6. **Who declares the string encodings in the NaN box?** Recommended:
   String declares its group, Any hands out the slots, and the assembled
   runtime proves the union ([Layouts compose](#layouts-compose)).
7. **Trust at the module boundary.** Does the runtime trust an `i64` from
   a program we compiled, or check it with `try_from_bits`? Recommended:
   trust it, because only our compiler makes programs and the WASM sandbox
   bounds any damage. Bits from anywhere else never become a reference:
   `try_from_bits` has no reference variants.
8. **Templates that allocate.** May an allocating function be inlined, now
   that `alloc` is an import? Recommended: yes, which relaxes a rule in
   modular-l0.md.
9. **Where the code lives.** Recommended: `fjs/codegen/ir`, with
   `fjs/codegen/wasm` and `fjs/codegen/rust` as emitters, decided before
   step 2.
10. **Names or indices for locals.** Names keep the printed IR readable,
    and indices make renaming in a pass trivial. Recommended: names, as
    today, until a pass shows a cost.
11. **`own` parameters in L0.** L0 borrows its arguments, so a function
    such as `concat` can never reuse the storage of an argument, even
    with `try_unique`. Recommended: keep L0 as it is, and measure before
    adding `own` variants.
12. **Wide integers.** Is exactness up to 128 bits worth the wide-integer
    pass, and how far does a two-word integer go: may it be a field, an
    operand of `div`, or converted to a float? Recommended: yes for
    locals, parameters and results, since `u64` arithmetic has no exact
    type without them; the rest when a use appears. A wide division
    would then be a function written in the IR, which the pass calls.
13. **Evaluation at compile time.** The interpreter can run a runtime
    constructor while compiling and emit the object as `stat` data. A
    literal then costs nothing at start-up, and `init` builds nothing.
    Recommended: later. The first version builds literals at start-up, as
    [L0 design §6](../wasm/l0-design.md#6-literals-built-once-at-start-up)
    does.
14. **Facts that relate two locals.** After `lt(i, n)` the checker does
    not know that `i` is below `n`, so an `at` inside that branch checks
    again, and a `push` checks its capacity. Recommended: no relational
    types. At the low level the second check is the same comparison of
    the same values, so a small pass, or the target's optimizer, removes
    it. Measure first, and add a bulk `push` if copying shows up.

## What the review changed

The second review read the first draft against the notes it builds on,
and the [comparison round](./comparison.md) read it against other IRs.
The Codex finding on the first draft, about pointer width, has its own
note, [pointer-width.md](./pointer-width.md). Codex's review of this
revision found a division that the WASM emitter could not spell and a
remainder that panics in Rust, and
[No target's corner case leaks in](#no-targets-corner-case-leaks-in)
answers both. It also found that a `uniq` stored in an object would
never be released, so
[an object now holds none](#heap-objects-are-immutable-once-frozen).

| Topic | First draft | Now | Why |
| --- | --- | --- | --- |
| Integer width | at most 64 bits; `add_carry` and `mul_wide` | exact up to 128 bits | `add` of two `u64` values had no type, so `wrap` could not even be written around it |
| Fitting | `wrap`, `narrow` and `try_narrow` as primitives | four definitions over ordinary operations | fewer primitives, and one rule for Rust's and CLIF's many |
| Division | the divisor's type must exclude 0 | `div` traps, `try_div` asks, and the type can still remove the check; the first draft's rule is now the low level's | an interval cannot say "not zero" for a signed divisor; −2^63 / −1 was not covered |
| Corner cases of targets | not covered | excluded by type at the low level, where data lowering adds the tests | Rust's `%` panics on −2^63 % −1, and WASM takes a shift's amount modulo the width |
| Wide operands | not covered | `div`, `rem` and float conversions take one word | WASM has no short form for them, and an emitter may not refuse a checked module |
| Failing operations | case by case | every check has two forms | one rule, and DESIGN.md §6 |
| Refinement | by example | two rules, sound because no local is reassigned | the checker has to be small enough to trust |
| Sums | flat, with groups only in a layout | trees, where every node is a type | groups compose across modules, and a shared field has a type |
| Borrowed pointers | "a borrowed local names its source" | `view(O)`, a fourth reference | the `p` of an arm on `long` had no type |
| Ownership kinds | copy or linear | copy, counted or unique | a counted value needs no linearity in written code; a unique one does |
| Results that borrow | not covered | a result holding a view borrows from the borrowed arguments | `unpack` returns such a value |
| What an object holds | not covered | copy and counted fields and items; no view and no `uniq` | the derived `release` then drops everything an object owns |
| State and constants | not covered | one Heap module; constants built in `init` | `thrown`, `enter` and `recover` need state |
| The floor | each target provides an allocator | the Heap module, at the low level | with two levels it can be IR code, run by the interpreter |
| Staging | checker, lifetime pass, emitters | two levels, three forms, one interpreter | every pass is tested by running before and after; emitters stay thin |
| Effects | `pure`, `traps`, `allocates`, `throws` | one bit, may fail | making a frozen value is not observable under L0 §14 |
| Layout across modules | an open question | groups compose, and the union is proved | modular-l0.md's hooks, as types |
| Names | brands only | brands, seals, object identity and recursion | recursive types had no rule |
| Testing | interpreter and parity tables | also a counting heap, mutants, golden tests and Rust's overflow checks | the comparison's findings on Miri, MIR and CLIF |
