# The NaN box in the planned IR

2026-11-11. A check of the draft in [type-system.md](./type-system.md).
The NaN box of Sergey's [NaN VM README](../../sergey-shandar/nanvm/README.md)
is written here in the draft's eDSL, first in one piece and then by
module, as [modular-l0.md](../wasm/modular-l0.md) splits the runtime, with
nineteen functions over it. A prototype of one slice of the IR runs all of
it, against the README's own functions and against JavaScript.

The prototype is the files whose names start with `nan-box-in-ir.`, next
to this note ([Running it](#running-it)). These are working notes, and
nothing here is decided: they say what the draft holds, what it leaves
open, and a proposal for each open point.

## Summary

- **The draft holds.** The whole box is one `bits(64, …)` declaration of
  27 lines, in the README's notation. It passes the layout proof: 23
  patterns and `f64c`, pairwise disjoint, and no pattern holds a number.
- **It composes.** By module, Any's frame and the groups of String,
  BigInt, Containers and Functions assemble to the same 24 variants, bit
  for bit. Each group is proved against Any's frame alone.
- **It derives the README.** The mask tests derived from the frame are
  the README's `is_ref`, `is_dyn_ref` and `is_short_bigint`, constant for
  constant, and its `is_bool` and `is_number` with fewer bits. The derived
  decision trees agree with the README's `typeof_` and with L0's `kind`
  on 48,055 values.
- **Code over it reads well.** Nineteen functions, twelve of them L0's,
  agree with JavaScript on 326 string literals in all ten encodings,
  1,600 concatenations and 211 integers.
- **The types catch mistakes.** Of 22 deliberate mistakes in the box, 15
  are caught without any comparison with JavaScript. The other 7 are
  wrong constants and the like, which only a parity table can catch.
  Another 22 hand-written mistakes are each refused for their own reason.
- **Two details need the owner.** Which bits the one NaN has, with
  `to_bits` taking an `f64c` ([5.1](#51-the-bits-of-the-one-nan)). And
  Any written over a frame of its own, which needs subtyping between two
  layouts over one carrier ([5.2](#52-any-is-written-over-its-frame)).
- **Thirteen smaller rules** are used by the draft without being stated
  ([5.3](#53-rules-the-draft-uses-but-does-not-state)), each with a
  proposal, and [5.4](#54-observations) has five observations.

## 1. The box in one piece

The draft's Layout section writes the box with three of its eight short
strings and two of its five reference kinds. In full, it is
[`nan-box-in-ir.flat.mjs`](./nan-box-in-ir.flat.mjs):

```js
// The objects on the heap. A type that is declared later is a thunk.
const StrObj = object('StrObj', { units: tail(u16, u(31)) })
const BigObj = object('BigObj', { negative: bool, words: tail(u64, u(31)) })
const ArrObj = object('ArrObj', { items: tail(() => any, u(31)) })
const ObjObj = object('ObjObj', { entries: tail({ key: () => any.string, value: () => any }, u(31)) })
const FnObj = object('FnObj', {
    code: code([() => any, () => any], () => any),
    frame: () => any,
    length: u(31),
    text: () => any.string,
})

// Repeated layouts are host functions.
const nibble = n => n.toString(2).padStart(4, '0')
/** A short string in a row with an 8-bit tag: `n` units of `w` bits, and the tag holds `n`. */
const row = (w, n) => [`0111_1111_1111_0…0_u…u_${nibble(n)}_1000`, { u: array(u(w), n) }]
/** The two references of a kind: `heap` is counted, and `lit` is static, the README's `s` bit. */
const long = (tttt, O) => ({
    heap: [`0111_1111_1111_${tttt}_p…p_10`, { p: ref(O) }],
    lit: [`1111_1111_1111_${tttt}_p…p_10`, { p: stat(O) }],
})

export const any = bits(64, {
    number: f64c,
    boolean: ['b111_1111_1111_0…0_0001_0000', { b: bool }],
    undefined: '0111_1111_1111_0…0_0010_0000',
    null: '0111_1111_1111_0…0_0011_0000',
    string: {
        empty: '0111_1111_1111_0…0_0000_1000',
        short: {
            s1x16: row(16, 1),
            s2x16: row(16, 2),
            s4x7: row(7, 4),
            s5x7: row(7, 5),
            s6x7: row(7, 6),
            s3x16: ['0111_1111_1111_u…u_0100', { u: array(u16, 3) }],
            s8x6: ['0111_1111_1111_u…u_1100', { u: array(named('Id6', u(6)), 8) }],
            s7x7: ['1111_1111_1111_u…u_100', { u: array(u(7), 7) }],
        },
        long: long('0100', StrObj),
    },
    bigint: {
        short: ['v111_1111_1111_v…v_1', { v: i(52) }],
        long: long('0101', BigObj),
    },
    array: long('0111', ArrObj),
    object: long('0011', ObjObj),
    function: long('0110', FnObj),
})
```

- **Repeated layouts are host functions,** as the draft's "Generics are
  host functions" allows: the README's five rows with an 8-bit tag come
  from `row`, and the ten references from `long`.
- **The 23 patterns are those of
  [nan-box-patterns.md](./nan-box-patterns.md),** mask for mask.
- **Two things differ from the draft's version.** The 6-bit unit is a
  named type ([5.3](#53-rules-the-draft-uses-but-does-not-state), item
  9), and a type declared later is a thunk, `() => any` (item 11).

## 2. The box by module

modular-l0.md gives the `i64` to Any: "Any owns the encoding of the `i64`
itself: the kind tag, the scalars that live inside the `i64`, and
reference counts". The draft's "Layouts compose" has Any hand out the
slots and the assembled runtime declare the union. Written out, Any needs
a type of its own for the 64 bits, because its functions, `kind`,
`to_f64` and the derived `dup` and `drop`, are written before any other
module exists. That type is the *frame*, and the code is
[`nan-box-in-ir.box.mjs`](./nan-box-in-ir.box.mjs).

### Any's frame

```js
// The README's type tags, and 0111 for an array, which it does not have.
const tag = { object: '0011', string: '0100', bigint: '0101', function: '0110', array: '0111' }
/**
 * README: `s111_1111_1111_tttt_....10`, a reference. `s` is static, `tttt`
 * is the type, and the rest is the pointer without its two alignment bits.
 * A kind's module gives the type of its objects.
 */
export const reference = (kind, O) => ({
    heap: [`0111_1111_1111_${tag[kind]}_p…p_10`, { p: ref(O) }],
    lit: [`1111_1111_1111_${tag[kind]}_p…p_10`, { p: stat(O) }],
})
// What an object of another module holds is not Any's to know.
const Storage = object('Storage', {})

const scalars = {
    number: f64c,
    boolean: ['b111_1111_1111_0…0_0001_0000', { b: bool }],
    undefined: '0111_1111_1111_0…0_0010_0000',
    null: '0111_1111_1111_0…0_0011_0000',
}

// A slot is a variant whose one field is a hole, x.
export const frame = bits(64, {
    ...scalars,
    string: {
        // README: `s111_1111_1111_..._vv00`, the scalars. Any keeps the rows
        // that end in 0000. The rows that end in 100 and in 1000 are String's.
        tag100: ['x111_1111_1111_x…x_100', { x: u(50) }],
        tag1000: ['x111_1111_1111_x…x_1000', { x: u(49) }],
        long: reference('string', Storage),
    },
    bigint: {
        // README: `s111_1111_1111_..._vvv1`, the short bigint.
        short: ['x111_1111_1111_x…x_1', { x: u(52) }],
        long: reference('bigint', Storage),
    },
    array: reference('array', Storage),
    object: reference('object', Storage),
    function: reference('function', Storage),
})

/** A module fills the hole of a slot with a pattern of its own, so it cannot write a bit outside it. */
export const slot = path => fill(patternAt(frame, path))

/** The runtime's union: the frame with each slot refined by the group of its module. */
export const assemble = groups => refines(bits(64, { ...scalars, ...groups }), frame)
```

- **A slot is a variant whose one field is a hole.** `x` is an unsigned
  integer as wide as the hole, so any bits are a value of it. String's
  two slots are the README's rows that end in `100` and in `1000`, and
  BigInt's is `…1`.
- **Each hole is the sign bit and the bits below the exponent,** so it is
  not adjacent. The `1` that starts the pattern of `s7x7` and the sign of
  a short bigint are both the box's sign bit, written by the module that
  owns the slot.
- **A reference of the frame points to `Storage`,** an object type with
  no fields. Any counts references and never reads what they point to,
  and a module refines the reference with its own object type.
- **`slot(path)` is the draft's "host function from a payload pattern to
  a full pattern".** The payload pattern is exactly as wide as the hole
  and written from the hole's top bit, so a module cannot write a bit
  outside its slot. It is modular-l0.md's `box_inline`, and
  `reference(kind, O)` is its `box` for a reference.
- **`assemble(groups)` declares the union,** as the draft says, and
  proves that it refines the frame
  ([5.2](#52-any-is-written-over-its-frame)).

### String's group

```js
export const StrObj = object('StrObj', { units: tail(u16, u(31)) })
// A unit of six bits is a code of the alphabet below and not a code unit,
// so it has a name, and no code can use one for the other by mistake.
const Id6 = named('Id6', u(6))

// String's two slots. A hole is filled from its top bit, which is the sign.
const tag100 = slot('string.tag100')   // 50 bits
const tag1000 = slot('string.tag1000') // 49 bits
const nibble = n => n.toString(2).padStart(4, '0')
/** In the slot that ends in 1000, the next four bits are the length. */
const row = (w, n) => tag1000(`0_0…0_u…u_${nibble(n)}`, { u: array(u(w), n) })

export const string = bits(64, {
    empty: tag1000('0…0'),
    short: {
        s1x16: row(16, 1),
        s2x16: row(16, 2),
        s4x7: row(7, 4),
        s5x7: row(7, 5),
        s6x7: row(7, 6),
        s3x16: tag100('0_u…u_0', { u: array(u16, 3) }),
        s8x6: tag100('0_u…u_1', { u: array(Id6, 8) }),
        s7x7: tag100('1_u…u', { u: array(u(7), 7) }),
    },
    long: reference('string', StrObj),
})
```

- `string` is a type of its own. String's functions take it, and the
  check proves it against the frame's `string` node without the other
  modules.
- `long` refines the frame's `string` references with `StrObj`.

### BigInt, Containers and Functions

```js
// The magnitude, from the least significant word, and the sign.
export const BigObj = object('BigObj', { negative: bool, words: tail(u64, u(31)) })

export const bigint = bits(64, {
    short: slot('bigint.short')('v…v', { v: i(52) }),
    long: reference('bigint', BigObj),
})
```

```js
export const ArrObj = object('ArrObj', { items: tail(() => any, u(31)) })
export const ObjObj = object('ObjObj', { entries: tail({ key: string, value: () => any }, u(31)) })
export const FnObj = object('FnObj', {
    code: code([() => any, () => any], () => any),
    frame: () => any,
    length: u(31),
    text: string,
})

// ── The runtime ──────────────────────────────────────────────────────────
// The proof of the whole box runs here: no two patterns overlap, none holds
// a number, and each module stayed inside its slots.

export const groups = {
    string,
    bigint,
    array: reference('array', ArrObj),
    object: reference('object', ObjObj),
    function: reference('function', FnObj),
}
export const any = assemble(groups)
```

- **The short bigint fills its hole with one signed field,** `i(52)`,
  whose sign is the box's sign bit, which is the draft's reading of the
  README.
- **Containers and Functions take no slot.** They refine the frame's
  references with their objects.
- **A group is the union's node, not a copy.** `any.only('string')` is
  String's `string` itself, so a String function takes a value of the
  union at no cost.

## 3. What the frame derives

The draft's first proof of a layout
([What the compiler derives](./type-system.md#what-the-compiler-derives))
is that "the derived tree has to agree with" the README's `typeof_` and `is_*` functions. The tests below
are derived from the frame, and [5.2](#52-any-is-written-over-its-frame)
says why not from the union. Each is one mask test, `x & mask == value`,
true for the variants asked for and false for the others. Every bit that
junk lets it drop is dropped, from the top bit down.

| Test | Derived from the frame | README |
| --- | --- | --- |
| `is_bool` | `x & 0x7FF0_0000_0000_003F == 0x7FF0_0000_0000_0010` | `x & 0x7FF0_0000_0000_00FF == 0x7FF0_0000_0000_0010` |
| `is_ref` | `x & 0x7FF0_0000_0000_0003 == 0x7FF0_0000_0000_0002` | the same |
| `is_dyn_ref` | `x & 0xFFF0_0000_0000_0003 == 0x7FF0_0000_0000_0002` | the same |
| `is_short_bigint` | `x & 0x7FF0_0000_0000_0001 == 0x7FF0_0000_0000_0001` | the same |
| `is_number` | finite, or `x & 0x0000_0000_0000_003F == 0` | finite, or `x & 0x7FF0_0000_0000_00FF == 0x7FF0_0000_0000_0000` |
| `is_short_string` | no single mask test exists, and the tree finds it | two tests |

- `is_bool` and `is_number` drop bits 6 and 7, which only junk patterns
  set.
- The derived `is_dyn_ref` is the draft's
  [Counting: the derived `dup`](./type-system.md#counting-the-derived-dup),
  constant for constant.

The tree for L0's `kind`, derived from the frame, has 7 one-bit tests at
most:

```text
exponent not all ones: 3
else
  bit 0 is 1: 5
  bit 0 is 0
    bit 1 is 1
      bit 48 is 1
        bit 49 is 1
          bit 50 is 1: 6
          bit 50 is 0: 7
        bit 49 is 0: 5
      bit 48 is 0
        bit 49 is 1: 8
        bit 49 is 0: 4
    bit 1 is 0
      bit 2 is 1: 4
      bit 2 is 0
        bit 3 is 1: 4
        bit 3 is 0
          bit 4 is 1
            bit 5 is 1: 1
            bit 5 is 0: 2
          bit 4 is 0
            bit 5 is 1: 0
            bit 5 is 0: 3
```

- It agrees with the function `kind` on every sample, and the tree for
  `typeof` agrees with the README's `typeof_`.
- The README's `typeof_` needs at most 4 tests and a shift, because it
  reads the type from the `tttt` bits.
  [5.3](#53-rules-the-draft-uses-but-does-not-state), item 13, is about
  a tree that can do the same.

## 4. Functions over the box

All nineteen are in [`nan-box-in-ir.box.mjs`](./nan-box-in-ir.box.mjs):

- **Any:** `kind`, `to_f64`, `from_f64`, `to_bool`, `from_bool`, `same`,
  and L0's four constants.
- **String:** `length`, `unit`, `from_unit` and `concat`, with `pack`,
  `seal`, `literal`, `append` and two functions for the 6-bit alphabet.
- **BigInt:** `sign`, `words` and `from_i64`. String's `length` and
  BigInt's `words` are the two halves of L0's `length` that modular-l0.md
  splits by module.

### Reading a string

```js
/** A host function: the same arm for every variant of a group. */
const each = (group, arm) => Object.fromEntries(variants(group).map(name => [name, arm]))

/** L0 `length` of a string: the number of UTF-16 code units. */
export const length = fn({ s: string }, u(31), ({ s }) =>
    match_(s, {
        empty: () => 0n,
        short: each(string.short, ({ u }) => u.length),
        long: ({ p }) => p.units.length,
    }))

// The alphabet of a 6-bit unit: $, 0 to 9, A to Z, _ and a to z.
const alphabet = constant(array(u16, 64),
    [...'$0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'].map(c => BigInt(c.charCodeAt(0))))
/** The code unit of a 6-bit code. A `u(6)` always indexes the table, so the read has no check. */
const fromId6 = fn({ c: Id6 }, u16, ({ c }) => alphabet.at(as(u(6), c)))

/** L0 `unit`: the code unit at index i, or a trap past the end. */
export const unit = fn({ s: string, i: u(31) }, u16, ({ s, i }) =>
    match_(s, {
        empty: () => trap('not an index'),
        short: {
            ...each(string.short, ({ u }) => u.at(i)),
            s8x6: ({ u }) => fromId6(u.at(i)),
        },
        long: ({ p }) => p.units.at(i),
    }))
```

- **`each(group, arm)`** is a host function that gives one arm to every
  variant of a group, so `length` has three arms where the draft's
  example has one per encoding. `u.length` is a constant of the array's
  type.
- **Index checks are where they must be.** `u.at(i)` traps past the end
  of a short string, and `p.units.at(i)` past the end of a long one. The
  read of `alphabet` has no check, because a `u(6)` always indexes it.
- **The `s8x6` arm has to convert.** Without it, `each` would return the
  6-bit code as a code unit. With the draft's `u(6)` the types accepted
  that, because widening is implicit. With `Id6` it is refused.

### Building a string

```js
// Host functions that unroll over the units of a short string.
const indices = n => Array.from({ length: n }, (_, k) => BigInt(k))
/** Goes on with the payloads of the options, or answers `none` at the first that has none. */
const all = (options, then, got = []) => options.length === 0 ? then(got)
    : match_(options[0], { some: x => all(options.slice(1), then, [...got, x]), none: () => none })
const s16 = (n, p) => some(string.short[`s${n}x16`]({ u: indices(n).map(k => p.units.at(k)) }))
const s7 = (n, p) => all(indices(n).map(k => try_narrow(u(7), p.units.at(k))),
    u => some(string.short[`s${n}x7`]({ u })))

/** The short form of the units of an object, if they have one. */
export const pack = fn({ p: view(StrObj) }, option(inline), ({ p }) =>
    match_(p.units.length, {
        0: () => some(string.empty),
        1: () => s16(1, p),
        2: () => s16(2, p),
        3: () => s16(3, p),
        4: () => s7(4, p),
        5: () => s7(5, p),
        6: () => s7(6, p),
        7: () => s7(7, p),
        8: () => all(indices(8).map(k => toId6(p.units.at(k))), u => some(string.short.s8x6({ u }))),
        else: () => none,
    }))

/** Ends the building of a string. */
export const seal = fn({ d: own(uniq(StrObj)) }, string, ({ d }) =>
    match_(pack(d), {
        some: s => s,
        none: () => string.long.heap({ p: freeze(d) }),
    }))
```

`inline` is `string.only('empty', 'short')`, `some` and `none` are its
`option`, and `toId6` gives the 6-bit code of a unit by the ranges of the
alphabet.

- **One string, one form.** `pack` picks the short encoding of a length
  when the units fit, and both `seal` and `literal` use it, so a string
  has one form whether it was built or written. The check compares every
  short result of `concat` with the bits of the same literal.
- **`pack` matches on an integer,** the length, with `else` for the rest.
- **Ownership is visible.** `seal` consumes the `uniq` that it freezes,
  and `pack` borrows it as a `view`. The result of `pack` is
  `option(inline)`, a copy type, because no variant of `inline` holds a
  reference.

```js
/** Appends the units of `s` to the string that is being built. */
const append = fn({ d: own(uniq(StrObj)), s: string }, uniq(StrObj), ({ d, s }) =>
    loop_({ d: uniq(StrObj).of(d), i: u(31).of(0n) }, ({ d, i }, next) =>
        if_(lt(i, length(s)),
            next({ d: push(d, unit(s, i)), i: add(i, 1n) }),
            d)))

/** L0 `concat`: allocate once, fill, seal. */
export const concat = fn({ a: string, b: string }, string, ({ a, b }) =>
    let_({ n: narrow(u(31), add(length(a), length(b))) }, ({ n }) =>
        seal(append(append(alloc(StrObj, {}, n), a), b))))
```

This is the draft's
[Building](./type-system.md#building-two-long-strings-joined) example, over
any two strings instead of two long ones. `concat` allocates once, and `seal` gives a short string
when the result fits.

### A bigint

```js
/** L0 `sign`: -1, 0 or 1. A long bigint is never zero. */
export const sign = fn({ b: bigint }, int(-1n, 1n), ({ b }) =>
    match_(b, {
        short: ({ v }) => if_(lt(v, 0n), -1n, if_(eq(v, 0n), 0n, 1n)),
        long: ({ p }) => if_(p.negative, -1n, 1n),
    }))

/** L0 `length` of a bigint: the number of 64-bit words of its magnitude. */
export const words = fn({ b: bigint }, u(31), ({ b }) =>
    match_(b, {
        short: ({ v }) => if_(eq(v, 0n), 0n, 1n),
        long: ({ p }) => p.words.length,
    }))

// The magnitude of an i64 is at most 2^63, which is a u64 and not an i64.
const abs = n => if_(lt(n, 0n), sub(0n, n), n)

/** A bigint from an integer of one word. */
export const from_i64 = fn({ n: i64 }, bigint, ({ n }) =>
    match_(try_narrow(i(52), n), {
        some: v => bigint.short({ v }),
        none: () => bigint.long.heap({
            p: freeze(push(alloc(BigObj, { negative: lt(n, 0n) }, 1n), abs(n))),
        }),
    }))
```

- **`v` is signed.** A function that reads it as a `u(52)` is refused.
- **`abs(n)` has the type `int(0n, 2n ** 63n)`,** which is a `u64` and not
  an `i64`, so the word holds it with no check. `try_narrow(i(52), n)`
  picks the encoding.

### Any

```js
/** L0 `from_f64`. A float from outside can hold any NaN. */
export const from_f64 = fn({ x: f64 }, frame.only('number'), ({ x }) => frame.number(canon(x)))
```

```js
/** L0 `same`: two arrays, objects or functions are the same value. */
const container = frame.only('array', 'object', 'function')
export const same = fn({ a: container, b: container }, bool, ({ a, b }) => identical(a, b))
```

- **`canon` cannot be forgotten.** `from_f64` takes an `f64`, and
  `frame.number` takes an `f64c`. Without `canon` the function is
  refused: "an f64 where an f64c is needed".
- **`same` takes containers only,** so passing it a `null` is a type
  error. Its body needs `identical`, which the draft does not have.
- `kind`, `to_f64` and `to_bool` are a `match` each, written over the
  frame.

### What caught the mistakes

[`nan-box-in-ir.mutants.py`](./nan-box-in-ir.mutants.py) makes one deliberate mistake at a time and
runs the check.

| Caught by | Mistakes in the box | For example |
| --- | --- | --- |
| the layout proof | 7 | two kinds under one tag; `s3x16` over `s8x6`; a slot that holds a number; BigInt writing into String's slot |
| a structural type | 4 | the 6-bit code as a unit; `uniq` where `ref` is needed; no `canon` |
| a range | 3 | `i(53)` for the short bigint; `abs = n => n`; a 6-bit code of 64 |
| a trap | 1 | `le` for `lt` in `append` |
| only the comparison with JavaScript | 7 | wrong constants in `toId6`, swapped signs or tags, an encoding left out, `fromId6` without its table |

- **The first four rows are the checker's job.** The prototype tests a
  range as a value passes, where the checker would refuse the code when
  it is built.
- **The last row is the parity tables' job.** Types cannot know the
  alphabet or which encoding a length should have.
- **The prototype's own mistakes are caught too.** Seven mutants of
  `nan-box-in-ir.edsl.mjs`, such as a reversed field order or a disjointness proof that
  always passes, are all caught.
- **Each refusal has its reason.** `node nan-box-in-ir.check.mjs --reasons`
  prints why
  each of the 22 hand-written mistakes is refused, from "a payload that
  is wider than its slot" to "a value of the frame passed off as one of
  the union".

## 5. What the exercise pins down

### 5.1 The bits of the one NaN

The draft says that "`f64c` holds one NaN, the canonical one", and its
[Floats](./type-system.md#floats) that "A NaN result's sign and payload
depend on the target".
[L0 design §4](../wasm/l0-design.md#4-numbers-the-runtime-canonicalises-nan)
says that "`from_f64` may change a NaN's payload". Neither says which NaN is the
canonical one. Measured on one x86-64 machine, with
[`nan-box-in-ir.nan-bits.mjs`](./nan-box-in-ir.nan-bits.mjs) under Node 22's WASM engine and
[`nan-box-in-ir.nan-bits.rs`](./nan-box-in-ir.nan-bits.rs) built with `rustc -O`:

| Operation | WASM | Rust |
| --- | --- | --- |
| `0 / 0`, `inf - inf`, `0 * inf`, `sqrt(-1)` | `0xFFF8_0000_0000_0000` | the same |
| `+nan + 1` | `0x7FF8_0000_0000_0000` | the same |
| `-nan + 1`, `1 + -nan`, `neg(+nan)` | `0xFFF8_0000_0000_0000` | the same |
| `+nan * -nan` | `0x7FF8_0000_0000_0000` | `0xFFF8_0000_0000_0000` |
| `-nan * +nan`, `min(+nan, 1)`, `max(1, -nan)`, `floor(-nan)` | `0xFFF8_0000_0000_0000` | not run |
| `abs(-nan)`, `nearest(+nan)` | `0x7FF8_0000_0000_0000` | not run |
| `0x7FF8_0000_0000_1234 + 1` | `0x7FF8_0000_0000_1234` | not run |
| `0x7FF0_0000_0000_0001 + 1`, a signaling NaN | `0x7FF8_0000_0000_0001` | not run |

Rust's `f64::NAN` is `0x7FF8_0000_0000_0000`. The WASM spec and Rust's
documentation could not be fetched from this environment, so what they
promise is cited from memory below.

- **`canon` is needed, not only careful.** x86-64 gives
  `0xFFF8_0000_0000_0000` for every invalid operation. If the one NaN is
  `0x7FF8_0000_0000_0000`, that result is not an `f64c`, so nearly every
  boxed NaN goes through `canon`. The types already force it.
- **The bits of an `f64` NaN are not a function of the program.** WASM
  and Rust disagree on `+nan * -nan` on the same machine, and `min` of a
  canonical NaN flips its sign. The interpreter holds floats as
  JavaScript numbers, which have one NaN. So `to_bits` on an `f64` would
  show a program what the interpreter cannot predict, and the parity runs
  would differ by target.
- **A NaN with a payload decodes as another kind.** Boxed without
  `canon`, `0x7FF8_0000_0000_1234` reads as an `s3x16` with the units
  `0x0123`, `0x0000` and `0x8000`, and `0x7FF8_0000_0000_0001` as the
  bigint 2^50. The draft's point about the classic exploit holds, and the
  types refuse the code that would allow it.
- **The README accepts `0xFFF8_0000_0000_0000` as a number.** Its
  `is_number` and `typeof_` are true for it. Under a one-NaN `f64c` it is
  junk. No pattern of the box holds either quiet NaN, so both rules are
  still open.

Two options:

- **A. One NaN, `0x7FF8_0000_0000_0000`.** Arithmetic, `neg`, `min`,
  `max`, `sqrt` and rounding give `f64`. `abs` keeps `f64c`, because it
  clears the sign bit and nothing else (from memory), and so do integer
  conversions and literals. `identical` on numbers is JavaScript's
  `Object.is`.
- **B. Both quiet NaNs with a zero payload.** WASM gives such a NaN for
  any operation whose NaN operands have zero payloads (from memory, and
  the 16 measurements above agree), so arithmetic over `f64c` operands
  would stay `f64c` on WASM with no `canon`. The price: `identical` on
  numbers is no longer `Object.is`, Rust promises the same only per CPU
  (from memory), so its emitter keeps the `canon`, and `to_bits` still
  needs a type with one NaN.

Recommended: A, with these two rules added to the draft's "Floats":

- **The one NaN is `0x7FF8_0000_0000_0000`,** Rust's `f64::NAN`.
- **`to_bits` takes an `f64c`.** `from_bits` stays total and gives an
  `f64`. Code that wants the bits of any float writes
  `to_bits(canon(x))`, so no operation can tell which NaN an `f64` holds,
  and every target agrees with the interpreter. B can come later, if a
  measurement shows that `canon` costs.

### 5.2 Any is written over its frame

The draft's [Layouts compose](./type-system.md#layouts-compose) says
that "Any owns the box and hands out the slots", that "The
assembled runtime declares the union", and that "`kind`, `dup` and `drop`
are derived from the union". Derived from the union, Any's tests depend
on what the other modules put into their slots:

- **A test can be true in another module's slot.** From the frame,
  `is_null` is `x & 0x7FF0_0000_0000_003F == 0x7FF0_0000_0000_0030`. From
  today's union it is `x & 0x7FF0_0000_0000_0037 == 0x7FF0_0000_0000_0030`,
  which is also true for `0x7FF0_0000_0000_0038`. That value is a row of
  String's `1000` slot that String does not use today. A String that uses
  it would make Any's `kind` wrong, unless Any is compiled again.
- **A test can change with another module's encodings.** `is_bool` from
  today's union is the frame's. From a union whose String leaves the
  `1000` slot empty, it is
  `x & 0x7FF0_0000_0000_0037 == 0x7FF0_0000_0000_0010`.

So the proposal:

- **Any is written over a frame of its own,** a `bits(64)` type whose
  slots are variants with a hole, and its tests, `kind`, `dup` and `drop`
  are derived from the frame. That is modular-l0.md's rule that "A module
  calls only the modules it depends on, through their functions, never
  through their layouts", and it lets a String module be swapped for
  another without compiling Any again.
- **The union refines the frame.** Every pattern of a group lies inside a
  slot or a reference of its own kind, so a test derived from the frame
  holds for every value of the union.
- **The proof is modular.** A group is checked against its kind's node of
  the frame alone, and the check does that for each group. The frame's
  patterns are disjoint, so two groups that pass cannot collide.
- **This needs one more subtyping rule.** The draft's subtyping has
  `S.only(x)` within `S.only(y)`, two subsets of one tree. The frame and
  the union are two trees over one carrier. The rule: a `bits` type `A`
  is a subtype of `B` when each pattern of `A` lies inside a pattern of
  `B` and can be read through that pattern's fields. A reference is in
  the same bits with the same mode, a hole takes any bits, and every
  other field is the same field. So a `string` is a `frame` (Any's `kind`
  takes it), a `frame.only('number')` is an `any` (Any's `from_f64`
  returns one to program code), and a `frame` is not an `any`.
- **No reference can hide in a slot.** Writing that rule down found a
  hole in the first version of the prototype: a module could put a `ref`
  inside a hole, where the frame's `dup` would never count it. The rule
  refuses it, as "string.hidden holds a ref where the frame's
  string.tag100 has none", and it refuses an inline value where the frame
  has a reference. So `dup` and `drop`, derived from the frame, count
  exactly the references of every value of the union.
- **What it costs.** Any's tests are the frame's, which can keep a bit
  that the smallest test for today's union would drop. They are still
  the README's tests or smaller ([3](#3-what-the-frame-derives)).

This is also the answer to the draft's
[open question 6](./type-system.md#open-questions), with Any's half
written out.

### 5.3 Rules the draft uses but does not state

Each item says what the draft has, what the box needed, and a proposal.
The prototype does what each proposal says.

1. **What a `match` arm receives.** Rule 1 of flow refinement says the
   operand "has the arm's type". The examples destructure fields,
   `s3x16: ({ u }) => …`, read a field that a group shares,
   `long: ({ p }) => …`, and take a float, `number: n => …`. Proposal: an
   arm receives the operand at the arm's type, a subset of the operand's
   type. Its fields, and the fields that all its variants share, are read
   as properties. The arm of an `f64c` variant receives the float.
2. **`bool` has no bits.** The prelude's `bool` is
   `sum({ false: unit, true: unit })`, a sum without declared bits, so it
   has no width, and the box's `{ b: bool }` cannot be laid out.
   Proposal: `const bool = bits(1, { false: '0', true: '1' })` in the
   prelude, and the rule that a field's type has a width: an integer
   range, a `bits` type, an array or a name of one of them.
3. **How wide an integer field is, and where an item goes.** "Each field
   is exactly as wide as its type" needs the width of `int(a, b)`.
   Proposal: the fewest bits that hold the range, in two's complement
   when it has negative values, so `int(0n, 8n)` takes 4 bits and `i(52)`
   52. Item 0 of a packed array is in the lowest bits. The README does
   not say, every short string's bits depend on it, and it is what makes
   `u.at(i)` a shift by `w * i`.
4. **What `…` counts.** "A field's width comes from its type, so at most
   one fill of fixed bits is left to the checker to count." A
   reference's `p…p` is counted too: its width comes from the pattern, 46
   bits, and "References fit" compares that with the heap. Proposal: at
   most one fill is counted, of fixed bits or of a reference.
5. **`match_` on an integer.** `pack` branches on a length from 0 to 8.
   The emission table has "branch on a small integer", spelled
   `br_table`, but `match` takes a sum. Proposal: `match_` over an
   integer, whose keys are values, with `else` for the rest, exhaustive
   by range.
6. **Array values.** Constructors take arrays, `s1x16({ u: [c] })`, and
   the draft has no array value. Proposal: a host array of n expressions
   is an `array(T, n)` value, checked item by item. Until the prototype
   checked items, a mutant that stored `u(6)` codes as `Id6` items
   passed.
7. **Constants.** The draft's `sixBit` is "a constant table of 64 code
   units", with no way to write one. Proposal: `constant(T, value)` for a
   module constant of a copy type. A table of 64 `u16` values is data,
   read with a `load`.
8. **Identity.** L0's `same`
   ([§14](../wasm/l0-design.md#14-identity-same-is-reference-identity-and-a-runtime-may-merge-equal-values))
   compares two containers by identity,
   and the draft's `eq` takes numbers. Proposal: `identical(a, b)` for
   any type with declared bits, true when the carriers are equal. On
   `any` it is JavaScript's `Object.is` for the scalars and the short
   forms, given one NaN, and identity for long strings, long bigints and
   containers. `same` is `identical` over the containers.
9. **A name needs its conversion.** A `named` type "is never converted
   implicitly", and the draft has no explicit conversion. Proposal:
   `as(T, e)` converts between a name and its definition, in both
   directions, and does nothing else. The draft's own 6-bit unit should
   be a name, as `Id6` is here: with `u(6)`, a mistake that returned the
   code as a unit passed the types, because a `u(6)` widens to a `u16`
   implicitly.
10. **What a slot is.** "Any can export each slot as a host function from
    a payload pattern to a full pattern." Proposal: a slot is a variant
    whose one field is a hole `x`, an unsigned integer as wide as its
    bits. `slot(path)` takes a payload pattern exactly as wide as the
    hole, written from the hole's top bit, and the hole need not be
    adjacent.
11. **Recursion before the union exists.** `ArrObj` holds `any`, and
    `any` is assembled after Containers declares `ArrObj`. The draft does
    recursion "by its name". Proposal: say how a name is declared before
    its definition. The prototype uses a thunk, `() => any`, as RTTI's
    data form does.
12. **The order in which a test drops bits.** The compiler "drops every
    bit that a test does not need", and more than one smallest test can
    exist. Dropping from bit 0 up gave `is_bool` the mask
    `0x7FF6_0000_0000_003D`, and from the top bit down
    `0x7FF0_0000_0000_003F`. Proposal: from the top bit down, which gives
    the README's constants, and the order is part of the rule, so that a
    golden test holds.
13. **A tree that reads a field.** The derived `kind` tree is 7 one-bit
    tests deep, where the README's `typeof_` takes 4 tests and reads the
    type from the `tttt` bits. Proposal for the compiler: a node of the
    tree may switch on a field, and a result may be the field itself.
    With today's tags that does not help `kind`: the README's `tttt` are
    JavaScript's `typeof` codes, and L0's kind tags agree with them for
    string, 4, and bigint, 5, but not for array, object and function, 6,
    7 and 8. If the box took `0110`, `0111` and `1000` for those three,
    the `kind` of a reference would be its `tttt` bits. That is a choice
    for the owners of the README and of L0, not for the IR.

### 5.4 Observations

- **"One value, one form" is an invariant, not a type.** `seal`,
  `literal` and `from_i64` keep it: a string has the short encoding of
  its length when its units fit, and a bigint is short when it fits 52
  bits. The types do not prove it: a mutant that sealed a seven-unit
  ASCII string into an object passed them, and only the comparison with
  literals caught it. `identical` and
  [L0 §19](../wasm/l0-design.md#19-bigints-are-canonical) rely on it. Recommended:
  keep it a module invariant, held by the parity tables.
- **A subset has its own ownership kind.** `string` is counted, but
  `string.only('empty', 'short')` holds no reference, so it is copy, and
  `pack` returns `option(inline)` with no count at all. The draft says
  that "`any` is counted, because some of its variants hold a `ref`".
  Proposal: the kind is computed for every type, a subset included.
- **Data for [open question 14](./type-system.md#open-questions).** `pack` checks each of up to 8 indexes,
  although its arm knows the length. `append` matches the encoding of `s`
  again for every unit, through `unit`, which the unpacked string of
  [IR choice 13](./ir-design.md#13-an-unpacked-string-is-an-ir-type-laid-out-by-the-runtime-module)
  would hoist out of the loop. `from_i64` checks the capacity
  of an object that it allocated one line before. Each is the same
  comparison of the same values again, as the question expects.
- **Data for [open question 13](./type-system.md#open-questions).** `literal` is an ordinary function over a
  `stat` object, and the check runs it 326 times. Run by the interpreter
  while compiling, a short literal becomes an `i64` constant, and a long
  one a `stat` object in a data segment.
- **An address is one `and`.** A reference keeps the offset without its
  two alignment bits in bits 47 to 2, so the offset is
  `x & 0x0000_FFFF_FFFF_FFFC`, with no shift. A static and a heap object
  must then have one layout from that offset, because an arm on `long`
  reads `p` from either.

## 6. What the prototype is not

- **Not the checker.** Structure is typed when the code is built: fields,
  names, references and their modes, `f64` and `f64c`, subsets and
  exhaustive matches. A range is tested as a value passes, where the
  checker would prove it.
- **No lifetime pass and no counted heap.** `own`, `uniq`, `freeze` and
  views are typed, and nothing counts.
- **No lowering.** The mask tests and trees are derived and compared with
  the README, but the functions run on an evaluator over the carriers.
- **Plain JavaScript modules,** not FunctionalScript. The repository's
  tsconfig checks every `.mjs`, so each file opts out with
  `// @ts-nocheck`.

## Running it

In this folder, with Node 22 or later:

```sh
node nan-box-in-ir.check.mjs            # sections 1 to 4
node nan-box-in-ir.check.mjs --reasons  # also why each mistake is refused
python3 -I nan-box-in-ir.mutants.py     # each deliberate mistake, and what caught it
node nan-box-in-ir.nan-bits.mjs         # the NaN bits of a WASM engine
rustc -O --crate-name nan_bits nan-box-in-ir.nan-bits.rs && ./nan_bits
```

| File | Holds |
| --- | --- |
| [`nan-box-in-ir.edsl.mjs`](./nan-box-in-ir.edsl.mjs) | the slice of the IR: types, `bits` layouts, their proofs, subtyping between layouts, derived tests and trees, and an evaluator |
| [`nan-box-in-ir.flat.mjs`](./nan-box-in-ir.flat.mjs) | the box in one piece |
| [`nan-box-in-ir.box.mjs`](./nan-box-in-ir.box.mjs) | the box by module, and the nineteen functions |
| [`nan-box-in-ir.check.mjs`](./nan-box-in-ir.check.mjs) | the checks; it ends with `823429 checks passed` |
| [`nan-box-in-ir.mutants.py`](./nan-box-in-ir.mutants.py) | the 29 deliberate mistakes, 22 in the box and 7 in the prototype |
| [`nan-box-in-ir.nan-bits.mjs`](./nan-box-in-ir.nan-bits.mjs), [`nan-box-in-ir.nan-bits.rs`](./nan-box-in-ir.nan-bits.rs) | the measurements of 5.1 |
