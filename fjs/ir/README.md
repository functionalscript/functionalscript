# Code IR

The typed, low-level IR between normalized FAST and the backends, as
[definition.md](../../doc/sasha-gil/ir/definition.md) proposes it. A module
is plain data from end to end: a producer writes it, the checker types it,
and the emitter writes WASM from the typed form, with no text between the
stages.

It is built in vertical slices, from the least risky to the most
([todo/slices.md](./todo/slices.md)). This directory holds the first two:
typed code written by hand, and the same code lowered from normalized FAST
([`from_fast`](./from_fast/README.md)). Neither has imports yet.

## Map of this directory

|Module                                 |Holds                                                                  |
|---------------------------------------|-----------------------------------------------------------------------|
|[`types.ts`](./types.ts)               |the data: types, terms, functions, modules, and the checker's answer   |
|[`.`](./module.f.mjs)                  |the constructors, and the facts about types that the stages share      |
|[`check`](./check/module.f.mjs)        |the checker: a type for every term, or the module refused with a reason|
|[`print`](./print/module.f.mjs)        |the IR as text, for review and golden proofs                           |
|[`wasm`](./wasm/module.f.mjs)          |the emitter, to the AST of [`fjs/media/wasm`](../media/wasm/README.md) |
|[`from_fast`](./from_fast/README.md)   |the lowering from normalized FAST, with the types from a table         |

```js
import { unwrap } from '../types/result/module.f.js'
import { write } from '../media/wasm/binary/write/module.f.mjs'
import { f64, fn, if_, lt } from './module.f.mjs'
import { check } from './check/module.f.mjs'
import { emit } from './wasm/module.f.mjs'

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
  [`module.f.mjs`](./module.f.mjs) (`if_`, `not`, `ne`, `return_`) are these.
- **Operators**: `add`, `sub`, `mul`, `eq`, `lt` and `le` of two integers,
  each exact, its result's range found by interval arithmetic; `add`, `sub`,
  `mul`, `div`, `neg`, `abs`, `sqrt`, `eq`, `lt` and `le` of floats; and
  `float` of an integer within ±2^53.

Everything else is refused with the function's name and the reason, never
answered with a plausible wrong module
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)): a
product with fields, a sum other than `bool` and `never`, a name for an
arm's operand, a call of another module, a range wider than a word, a
division of integers, integers mixed with floats, and a term of type `never`
where a value is used.

## Values in WASM

A range is an `i32` where it fits 32 bits and an `i64` where it does not,
read as unsigned where it holds no negative integer. Arithmetic runs in the
wider word of its operands and its result, which is exact because the
checker's range of the result fits its word; a comparison runs in the word
that both operands fit, signed where one may be negative. A float is an
`f64` and a `bool` an `i32`. The [emitter's](./wasm/module.f.mjs) module
documentation has the rest.

## Proofs

Each module's `proof.f.mjs` holds its golden texts and every refusal, over
the hand-written modules of [`testlib.f.mjs`](./testlib.f.mjs).
[`wasm/proof.mjs`](./wasm/proof.mjs) runs those modules on the host's
WebAssembly engine and compares every exported function with a JavaScript
twin on the same inputs, the edges of each type included.
[`from_fast/proof.mjs`](./from_fast/proof.mjs) does the same for
FunctionalScript functions lowered from their text, and their twins are the
functions themselves.
