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
(6a), the lifetime pass, which writes them (6b), constants, which a
module's `init` evaluates (6c), string literals, which its start
function makes (6d), array literals of values, which Containers'
builder makes (6e), reads of an array at a number key, with L1's
`typeOf` (6f), and a throw written by hand, with the effect bit that says
which functions may fail (7a), and the lowering of `throw` and of L1's
error table (7b). Next is slice 8 of that roadmap: builders.

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
- **Ownership on the host**: [`wasm/testlib.mjs`](./wasm/testlib.mjs)
  gives a parameter that owns its argument a `dup` of it, so the caller
  keeps its own count, reads a value of `any` that a function answers,
  compares it with the twin's and drops it, and treats a `unit` result as
  `undefined`, before it counts the cells. A host proof may run a function
  that owns a parameter, answers a string, or answers `unit`.

## What 6b adds

- **The lifetime pass** ([`lifetime`](./lifetime/module.f.js)): a module's
  plain stage, which reads a value of a sealed type as often as it needs
  and neither copies nor drops one, to its owned stage. A local moves at
  its last use where its context takes the value over, any other such use
  is a `dup`, and what a scope still owns is dropped where it ends, after
  its value. A temporary that a call or a `match` only borrows gets a name
  first, so that something drops it, and so does an argument, a first
  value or a next value that may leave by a `br`, with every part before
  it that does something, so that the `br` drops what they gave. Inside a
  `block` or a `loop` the locals around it are lent, and a `br` drops what
  the regions that it leaves own. The checker then checks the owned stage that the pass wrote,
  so a mistake of the pass is a refusal, never a leak; `checkPlain` is the
  checker without that check, which the pass starts from.
- **L0's functions that answer owned values, lowered**: String's
  `substring(s, start, end)` and Containers' `item(c, i)` join
  [the interfaces of L0](./l0/module.f.js) and both hosts, and the
  [lowering](./from_fast/README.md#the-l0-view) reads the view's
  `fromUnit`, `concat`, `substring` and `item`, whose values the caller
  owns: it writes the plain stage, and the pass drops each where its scope
  ends. Six FunctionalScript helpers that make strings, among them a loop
  that owns its string, run through the pass against JavaScript with
  nothing left over, and so do the random comparison's programs.

## What 6c adds

- **Constants** (`constant(module, name)`, printed `self.half` or
  `Any.undefined`): a module's own, whose term the module's `init`
  evaluates once, in their order, and one of an interface that the module
  imports, which the host makes, as Any's `undefined`, `null`, `true` and
  `false`
  ([L0 design §3](../../doc/sasha-gil/wasm/l0-design.md#3-constants-imported-immutable-globals)).
  A constant is borrowed, and nothing drops it. A constant's term reads
  only the constants before it, itself or through the functions that it
  calls, and the constant owns its value: a value of `any` that it only
  borrows is refused, so the lifetime pass copies one.
- **`init`** ([L0 design §20](../../doc/sasha-gil/wasm/l0-design.md#20-a-program-is-one-module-with-an-init-export)):
  a module with constants exports `init`, which sets each constant's
  global in their order, and no function of a module may have that name.
  The host calls it before anything else. It answers nothing yet: the
  program's value that L0's `init` answers waits for programs.
- **Constants on the host**: the [counting host](./l0/host/count/module.mjs)
  makes Any's four constants as cells `-1` to `-4`, each counted once for
  its global, and keeps what `init` makes, since nothing drops a constant.
  Each call after `init` must leave every cell as `init` left it.
- **The lowering of a module-level definition**: each definition of a
  module that is not a function is
  [a constant](./from_fast/README.md#constants), `#c0`, `#c1`, … by its
  place, kept where a function reads it, and `undefined` and `null` are
  Any's. Six FunctionalScript helpers that read constants of floats, of a
  `bool` and of strings run against JavaScript, and so do the random
  comparison's programs of constants.

## What 6d adds

- **String literals** (`lit(string, 'abc')`, printed `"abc"`): a literal
  of a sealed type whose interface names the function that makes its
  literals, of the one variant that the function makes. Any's `any` names
  String's `make_string`, so a string literal is `any.only(string)`
  ([L0 design §7](../../doc/sasha-gil/wasm/l0-design.md#7-strings-utf-16-units-in-l0)).
  `make_string` is no function of String's interface, since an address
  and a length are no values of the IR: only the emitter calls it. A
  literal is borrowed, as a constant is, and nothing drops it, so the
  lifetime pass copies one that a term takes over.
- **The start function**
  ([L0 design §6](../../doc/sasha-gil/wasm/l0-design.md#6-literals-built-once-at-start-up)):
  a module with string literals makes each once, for its type and its
  spelling, into a global of its own, from its UTF-16 units in a data
  segment, before `init` and before any call. Making a literal cannot
  throw, so WASM's start function, which has no way to report a throw, is
  enough for it.
- **The memory that the loader makes**
  ([L0 design §5](../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)):
  the module imports it and `data_base`, where its data segments start,
  and says in its `fjs.layout` section how many bytes they need. The
  [counting host](./l0/host/count/module.mjs) makes the memory from that
  section, with `data_base` past bytes that it keeps, and makes a cell for
  each literal; what the start function made it then keeps, as it does
  what `init` made.
- **The lowering of a string**: with the runtime, a string of FAST is a
  [literal](./from_fast/README.md#the-l0-view), and a definition of the
  module that holds one is the literal where a function reads it.
  Five FunctionalScript functions that read literals, among them the
  empty string, a unit past ASCII and a pair of surrogates, run against
  JavaScript, and so do the random comparison's programs of literals.

## What 7b adds

- **`throw x` lowered**: a `throw` of FAST is `Functions.throw` of its
  value, so a module that throws imports the runtime's `Functions`.
- **L1's error table**: a lowering's runtime may name L1's error module,
  and `errorTable` reads the table from that module's own normalized
  FAST, so its texts are never written twice. `error.k` is a literal of
  `any.only(string)` of its text, which the start function makes once.
  The table as a value, a computed key, and any other export of that
  module are refused.
- **Subjects**: L1's `functionText` runs as WASM against L1's own
  function, and [`throws.f.js`](./from_fast/throws.f.js) holds a copy of
  `bigintPair`, a throw of a literal, a rethrow and two of L1's errors
  one after the other. Each throws what its original throws and leaves
  nothing behind. The random comparison gains a form that throws a
  literal, its value or one of L1's errors, by the kind of the value.

## What 7a adds

- **A throw**: L0's `Functions.throw(own v: any) -> never`
  ([L0 design §13](../../doc/sasha-gil/wasm/l0-design.md#13-errors-a-throw-traps)),
  which `throw_(v)` writes. It takes over its value, and the emitter
  writes an `unreachable` after its call, since it answers `never`.
- **The effect bit**
  ([definition.md: One effect](../../doc/sasha-gil/ir/definition.md#one-effect)):
  a function of an interface declares that it may fail, `mayFail(...)`,
  as `throw` does, and String's `unit` and `substring` and Containers'
  `item`, `push` and `seal`, which trap where the view throws. One that
  answers `never` and does not say so is refused. The checker infers the
  bit for each function of a module, to a fixed point, and writes it
  beside the function; the printer writes `may fail`.
- **A throw leaves nothing behind**: the lifetime pass drops what a
  function owns before a call that answers `never`, but what the call
  borrows. A callee's throw, and a trap, abandon what the callers hold.
- **The counting host's side**: `throw` keeps the value and returns, and
  the host reads it after the trap by `has_thrown` and `thrown`, then
  calls `recover`, which frees what the trap abandoned.
- **Three outcomes** in every host proof and in the random comparison: a
  value, a throw of a value, or a trap, each the twin's. A function that
  cannot fail never fails, and the cells are checked after each outcome.

## What 6f adds

- **A read of an array at a number key**, `a[0]` or `a[Number(k)]`, by
  L1's `get` rules for that case: the integer of `u(31)` that the key
  holds, then `Containers.item` where it is less than the array's length,
  and `Any.undefined` where it is not, or where the key is a fraction, a
  NaN or an infinity; `-0` reads item `0`. Both answers are owned: the
  lifetime pass writes a `dup` of `undefined`. `exact` takes the term for
  a float that holds no integer, a trap unless it is given.
- **Only an array's**: a receiver of any other kind is refused, since
  `get` throws for `undefined` and `null`, which waits for slice 7, and
  reads an object or a string by a string. So is a member read that goes
  on to a call.
- **L1's `typeOf`**, lowered from its text: `typeNames` is a constant that
  `init` builds, and `typeOf` reads it at `kind(v)`. It runs against L1's
  own on values of every kind, and four FunctionalScript functions of
  [`reads.f.js`](./from_fast/reads.f.js) run against themselves on the
  edges of floats. The random comparison reads its arrays too.

## What 6e adds

- **A linear type of L0**: Containers' `builder`
  ([L0 design §8](../../doc/sasha-gil/wasm/l0-design.md#8-containers-a-builder-handle-then-seal)),
  which names no `dup` and no `drop`, so each path consumes it once, and
  no `kind`, so nothing matches it: the checker refuses a `match` of a
  type whose interface names no kind for it. An `i32` carries it.
- **A function that gives back a parameter**
  ([definition.md's binding rule 3](../../doc/sasha-gil/ir/definition.md#bindings)):
  `Signature.returns` names an owned parameter of the result's type, which
  the call answers. `begin_array(n)` answers a builder of `n` items,
  `push(own b, own v)` gives `b` back with `v` its next item, and
  `seal(own b)` answers the array, `any.only(array)`. The checker refuses
  an interface whose function gives back a parameter that it does not own
  or that is of another type than its result. In WASM the import answers
  nothing: the call keeps the builder in a local, with `local.tee`, and
  reads it after the call.
- **The counting host's builders**: `begin_array` begins one, `push` takes
  over a count of a cell as its next item, and `seal` makes a cell of the
  array; a push past the count, a seal of fewer items and a handle of no
  builder throw. A call that completes leaves no builder that it did not
  seal, and an array is the twin's where their items are, one by one.
- **The lowering of an array literal**: with the runtime, its items
  first, each lowered where it stands as the arguments of a call are, then
  `seal` of a `push` of each onto `begin_array` of their count, so nothing
  between them traps or leaves. An item is a value of `any`; a number, a
  boolean and a spread are refused, and the parser refuses a hole. A
  definition of the module that holds an array is a constant that `init`
  builds. Six FunctionalScript functions that make arrays run against
  JavaScript, and so do the random comparison's programs of arrays.

Everything else is refused with the function's name and the reason, never
answered with a plausible wrong module
([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)): a
product in a signature, or whose fields hold no value, a product that names
a field twice, a field that a product does not have, a sum other than
`bool`, `never` and the sealed types,
a name for the operand of a `bool`'s arm, a call of an interface that the
module does not import, a range wider than a word, a division of integers,
integers mixed with floats, a term of type `never` where a value is used, a
literal of a sealed type whose interface makes none, that is not a string,
or whose type is not the one that the interface makes, a string literal in
a module that does not import the interface that makes it, an interface
whose literals hold none of their type's variants, a constant that one
ABI imports by the name of a function, or of a constant whose global holds
another WASM value, a constant or a function named `memory` or `data_base`
in the ABI of an interface that makes literals, an `own` parameter of a
type that is not sealed,
a counted type without both a `dup` and a `drop` of their shapes, a module
whose owned stage does not consume each owned value once on every path, a
value of a linear type that the lifetime pass would have to copy or drop,
an interface that names a type, a function or a constant twice, a
constant of a product or of `never`, two constants of one name, a function
named `init`, a constant that reads itself or one after it, directly or
through the functions that it calls, a constant that only borrows its
value, a `br` to a loop that
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

A constant is a global of its type's WASM value: one of an interface is an
immutable global, imported from the interface's ABI by its name after the
functions, and one of the module a mutable global, zero until `init` sets
it. `init` takes nothing and answers nothing, and only a module with
constants has it.

A string literal is a mutable global of `any` too, which the module's
start function sets once from the literal's UTF-16 units, the low byte of
each first, by `make_string`, imported after the interfaces' functions. A
data segment at `data_base` holds the units of every literal, in the
memory that the loader makes: the module imports both, from the maker's
ABI, and only a module with string literals has them, the start function
and the `fjs.layout` section.

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
kind, and its twin reads the value with the L0 view. A call answers what
its twin does: the same value, a throw of the same value, or a trap, which
is a twin's `trap`, or a throw of the L0 view that the twin reads. A
module with string literals makes them as it is
instantiated, a module with constants then has its `init` called, and
then each function, which must leave every cell as they left it.
[`from_fast/proof.mjs`](./from_fast/proof.mjs) does the same for
FunctionalScript functions lowered from their text, and their twins are the
functions themselves, L1's `toBoolean`, `stringEquals`, `stringLess`,
`strictEquals` and `stringIndex` among them.
