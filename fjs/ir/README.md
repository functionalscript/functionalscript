# Code IR

The typed, low-level IR between normalized FAST and the backends, as
[definition.md](../../doc/sasha-gil/ir/definition.md) proposes it. A module
is plain data from end to end: a producer writes it, the checker types it,
and the emitter writes WASM from the typed form, with no text between the
stages.

It is built in vertical slices, from the least risky to the most
([todo/slices.md](./todo/slices.md) — roadmap of done, next and later).
This directory holds the first five and the first PRs of the sixth: typed
code written by hand, the same code lowered from normalized FAST
([`from_fast`](./from_fast/README.md)), values of unknown kind, read
through [the interfaces of L0](./l0/module.f.js), loops, functions that a
module does not export, with records and
[L1's native rows](./native/module.f.js), owned values written by hand
(6a), and the lifetime pass, which writes them (6b). Next is the rest of
counted values (`typeOf`), as stacked PRs in that roadmap, the lowering of
the L0 view's functions that answer owned values first.

## Map of this directory

|Module                                    |Holds                                                                  |
|------------------------------------------|-----------------------------------------------------------------------|
|[`types.ts`](./types.ts)                  |the data: types, terms, functions, modules, and the checker's answer   |
|[`.`](./module.f.js)                     |the constructors, and the facts about types that the stages share      |
|[`check`](./check/module.f.js)           |the checker: a type for every term, or the module refused with a reason|
|[`check/owned`](./check/owned/module.f.js)|the owned-stage check: each owned value consumed once on every path    |
|[`lifetime`](./lifetime/module.f.js)      |the lifetime pass: a module's plain stage to its owned stage           |
|[`print`](./print/module.f.js)           |the IR as text, for review and golden proofs                           |
|[`wasm`](./wasm/module.f.js)             |the emitter, to the AST of [`fjs/media/wasm`](../media/wasm/README.md) |
|[`from_fast`](./from_fast/README.md)      |the lowering from normalized FAST, with the types from a table         |
|[`l0`](./l0/module.f.js)                 |the interfaces of L0 as data, and `any`, the type that they seal       |
|[`l0/host`](./l0/host/module.f.js)        |the `fjs:l0` imports as the L0 view's functions, over handles          |
|[`l0/host/count`](./l0/host/count/module.mjs)|a host of the `fjs:l0` imports that counts every value, for host proofs|
|[`native`](./native/module.f.js)         |the interface of L1's native rows as data, `Native`                    |
|[`native/host`](./native/host/module.f.js)|a JavaScript host for the `fjs:l1-native` imports, over L1's rows      |

```js
import { unwrap } from '../types/result/module.f.js'
import { write } from '../media/wasm/binary/write/module.f.js'
import { f64, fn, if_, lt } from './module.f.js'
import { check } from './check/module.f.js'
import { emit } from './wasm/module.f.js'

const max = fn([['a', f64], ['b', f64]], f64, (a, b) => if_(lt(a, b), b, a))
const bytes = write(emit(unwrap(check({ imports: [], functions: [['max', max]], exports: ['max'] }))))
```

## What the first slice admits

- **Types**: integer ranges that fit one word of 64 bits, `f64`, `f64c`
  and `bool`, for parameters, results, blocks and arms; `never` for results,
  blocks and arms; and `unit`, which only `make([])` gives, for a `bool`'s
  payload and a `let`.
- **Terms**: `lit`, `get`, `let`, `op`, a `call` of a function of the same
  module, `make` with no field, a `variant` of `bool`, a `match` of a `bool`
  whose arms name no operand, `block` and `br`. The derived forms of
  [`module.f.js`](./module.f.js) (`if_`, `not`, `ne`, `return_`) are these.
- **Operators**: `add`, `sub`, `mul`, `eq`, `lt` and `le` of two integers,
  each exact, its result's range found by interval arithmetic; `add`, `sub`,
  `mul`, `div`, `neg`, `abs`, `sqrt`, `eq`, `lt` and `le` of floats; and
  `float` of an integer within ±2^53.

## What the third slice adds

- **A sealed type**: `any`, a value of unknown kind, which the interface
  `Any` of [L0](./l0/module.f.js) seals, and `only(any, ...kinds)`, a
  value of some of its nine kinds. A module may write a sealed type only
  where it imports the interface that names it.
- **Imports**: interfaces, by name, each of them data: the ABI that binds
  it, `fjs:l0`, the sealed types that it names, with their variants, the
  function that answers a value's tag and the WASM value that carries it,
  and the signatures of its functions. A `call` of an imported interface's
  function reads a value through it.
- **Terms**: a `match` of a sealed type, whose arms take kinds and may name
  the operand at those kinds; `trap`, of type `never`, where L0 would trap;
  and `cast`, an arm for some kinds and a trap for the others.
- **Every value of `any` is borrowed**: a parameter, an arm's name for its
  operand, and a `let` of one. No function, of the module or of an
  interface, may give one, since its caller would own it, so nothing has to
  release one. 6a counts them, below.

## What the fourth slice adds

- **`loop`**: a label, parameters, each a local with its type and its
  first value, and a body, whose value is the loop's. A `br` to the loop's
  label gives a `make` with a field for each parameter, in their order: it
  sets them all, and the body runs again. `next(label, fields)` writes that
  `br`.
- **`trunc_sat`**, an operator from a float to an integer range that it
  names, as WASM truncates with saturation: towards zero, NaN to `0`, and a
  float past the range to its nearer end. `exact(T, x, name, body)` reads
  with it the integer that a float holds, and traps (`'inexact'`) where the
  float holds no integer of `T`, as L0 checks an index.
- **String's `unit`**: the UTF-16 unit of a string at an index of
  `u(31)`, which traps at or past the end, in
  [the interfaces of L0](./l0/module.f.js) and
  [the host](./l0/host/module.f.js).

## What the fifth slice adds

- **Products with fields**: `product(fields)`, a record of fields in their
  order, which `make` gives and `field(e, name)` reads, printed
  `{ i: 0.0, value: 0.0 }` and `r.value`. A record stays in its function:
  it may be a local, a loop's parameter, or the value of a `match`, a
  `block` or a `loop`, but no signature, of the module or of an interface,
  names one. A product is a subtype of another of the same fields, in the
  same order, each a subtype, and two join field by field.
- **L1's native rows**: [the interface `Native`](./native/module.f.js),
  of the ABI `fjs:l1-native`, whose functions are typed by what their
  bodies check: `bigintEquals` takes two values of `any.only(bigint)`, and
  `numberRemainder`, the row of `%`, two floats. Its
  [host](./native/host/module.f.js) calls
  [L1's own rows](../wasm/runtime/l1/native/module.f.js), which gain
  `numberRemainder`.
- **`Any.same`**: whether two arrays, objects or functions are the same
  value, in [the interfaces of L0](./l0/module.f.js) and
  [the host](./l0/host/module.f.js).

## What 6a adds

- **Owned values**: a function may answer a value of a sealed type, which
  its caller owns, and a parameter written `own(name, type)` is one that
  the callee owns, printed `own v: any`. `any` is counted: its interface
  names `Any.dup`, which borrows a value and answers one of its type, and
  `Any.drop`, which owns one and answers `unit`, as the checker requires of
  a counted type. String's `from_unit` and `concat` answer an owned string.
- **The owned-stage check** ([`check/owned`](./check/owned/module.f.js)),
  run on every module that the checker takes: each owned value is consumed
  once on every path, no borrow outlives the owned value that it leans on,
  the arms of a `match` and the exits of a `block` agree, and a loop owns
  or borrows each parameter as its first value is. A person may write the
  owned stage, as its proofs do; [the lifetime pass](./lifetime/module.f.js)
  writes it from the plain stage (6b).
- **A host that counts** ([`l0/host/count`](./l0/host/count/module.mjs)):
  `dup` and `drop` count a cell, and `from_unit` and `concat` make one.
  Every host proof of the emitter runs on it, and each call that completes
  must leave its arguments' cells as it found them, and no other.

## What 6b adds

- **The lifetime pass** ([`lifetime`](./lifetime/module.f.js)): a module's
  plain stage, which reads a value of a sealed type as often as it needs
  and neither copies nor drops one, to its owned stage. A local moves at
  its last use where its context takes the value over, any other such use
  is a `dup`, and what a scope still owns is dropped where it ends, after
  its value. A temporary that a call or a `match` only borrows gets a name
  first, so that something drops it. Inside a `block` or a `loop` the
  locals around it are lent, and a `br` drops what the regions that it
  leaves own. The checker then checks the owned stage that the pass wrote,
  so a mistake of the pass is a refusal, never a leak; `checkPlain` is the
  checker without that check, which the pass starts from.
- **Ownership on the host**: [`wasm/testlib.mjs`](./wasm/testlib.mjs)
  gives a parameter that owns its argument a `dup` of it, so the caller
  keeps its own count, and reads a value of `any` that a function answers,
  compares it with the twin's and drops it, before it counts the cells. A
  host proof may run a function that owns a parameter or answers a string.
- **L0's functions that answer owned values, lowered**: String's
  `substring(s, start, end)` and Containers' `item(c, i)` join
  [the interfaces of L0](./l0/module.f.js) and both hosts, and the
  [lowering](./from_fast/README.md#the-l0-view) reads the view's
  `fromUnit`, `concat`, `substring` and `item`, whose values the caller
  owns: it writes the plain stage, and the pass drops each where its scope
  ends. Six FunctionalScript helpers that make strings, among them a loop
  that owns its string, run through the pass against JavaScript with
  nothing left over, and so do the random comparison's programs.

Everything else is refused with the function's name and the reason, never
answered with a plausible wrong module
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)): a
product in a signature, or whose fields hold no value, a product that names
a field twice, a field that a product does not have, a sum other than
`bool`, `never` and the sealed types,
a name for the operand of a `bool`'s arm, a call of an interface that the
module does not import, a range wider than a word, a division of integers,
integers mixed with floats, a term of type `never` where a value is used, a
literal of a sealed type, an `own` parameter of a type that is not sealed,
a counted type without both a `dup` and a `drop` of their shapes, a module
whose owned stage does not consume each owned value once on every path, a
value of a linear type that the lifetime pass would have to copy or drop,
an interface that names a type or a function twice, a `br` to a loop that
does not give each of its parameters, in their order, and a `trunc_sat` of
anything but one float, or without the range that it saturates to.

## Values in WASM

A range is an `i32` where it fits 32 bits and an `i64` where it does not,
read as unsigned where it holds no negative integer. Arithmetic runs in the
wider word of its operands and its result, which is exact because the
checker's range of the result fits its word; a comparison runs in the word
that both operands fit, signed where one may be negative. A float is an
`f64` and a `bool` an `i32`.

A value of `any` is an `i64`, the carrier that its interface names; on a
JavaScript host it is a handle that [the host](./l0/host/module.f.js) maps
to a value. Each function of an imported interface is one WASM import, of
the interface's ABI by the function's name. A `match` of `any` asks for the
tag once and tests it with an `if` for each arm but the last, and a `trap`
is an `unreachable`.

A record is its fields' WASM values in order: a local of a record is a
local for each field, and a term of one leaves each field's value on the
stack, so a `match`, a `block` or a `loop` of a record has a multi-value
type, of WASM 2.0. A field of a local reads that local, and a field of
any other term drops the values after it and those before it.

A loop's parameters are locals: their first values are set before a WASM
`loop`, and a `br` to it sets them all from its fields, then branches to
the loop's start. `trunc_sat` is the saturating truncation of the range's
word, signed or unsigned, then clamped to the range's ends where they lie
inside the word's. The [emitter's](./wasm/module.f.js) module
documentation has the rest.

## Proofs

Each module's `proof.f.mjs` holds its golden texts and every refusal, over
the hand-written modules of [`testlib.f.mjs`](./testlib.f.mjs).
[`wasm/proof.mjs`](./wasm/proof.mjs) runs those modules on the host's
WebAssembly engine and compares every exported function with a JavaScript
twin on the same inputs, the edges of each type included. A function of
`any` runs over [the hosts](./l0/host/module.f.js), on a value of every
kind, and its twin reads the value with the L0 view; a trap of WASM is a
throw of the twin.
[`from_fast/proof.mjs`](./from_fast/proof.mjs) does the same for
FunctionalScript functions lowered from their text, and their twins are the
functions themselves, L1's `toBoolean`, `stringEquals`, `stringLess`,
`strictEquals` and `stringIndex` among them.
