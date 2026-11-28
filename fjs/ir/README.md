# Code IR

The typed, low-level IR between normalized FAST and the backends, as
[definition.md](../../doc/sasha-gil/ir/definition.md) proposes it. A module
is plain data from end to end: a producer writes it, the checker types it,
and the emitter writes WASM from the typed form, with no text between the
stages.

It is built in vertical slices, from the least risky to the most
([todo/slices.md](./todo/slices.md) — roadmap of done, next and later).
This directory holds all twelve, and the work after them that the
[roadmap](./todo/slices.md#after-slice-12) lists: typed code written by hand, the same code lowered from normalized FAST
([`from_fast`](./from_fast/README.md)), values of unknown kind, read
through [the interfaces of L0](./l0/module.f.js), loops, functions that a
module does not export, with records and
[L1's native rows](./native/module.f.js), owned values written by hand
(6a), the lifetime pass, which writes them (6b), constants, which a
module's `init` evaluates (6c), string literals, which its start
function makes (6d), array literals of values, which Containers'
builder makes (6e), reads of an array at a number key, with L1's
`typeOf` (6f), a throw written by hand, with the effect bit that says
which functions may fail (7a), the lowering of `throw` and of L1's
error table (7b), the L0 view's `buildArray`, lowered as one loop of
Containers' builder (8b), and `buildObject` with `{}` and `objectSpread`
(8c). The first PR of the eighth, 8a, changed the L0 view itself, so
that it calls a builder's callbacks in the order of that loop. Slice 9a
adds Any's `from_f64` and `from_bool`, so a number or boolean meets
`any` and can be an array item. Slice 9b adds the `code` type and
`call_ref` (9b1), L0's `Functions.call` (9b2), and the lowering of a
call of a function value, with L1's coercions and `call` (9b3). Slice
10 lowers L1's `get` (10a), its arithmetic and relational operators
(10b), and the whole L1 module as one, run on the parity table (10c).
Then Any's copy variants leave the counts of `undefined`, `null` and
`boolean` out. Slice 11 lowers whole programs with no signature table:
their operators and member reads through L1, linked into the same module
(11a), closures (11b), and spread and rest parameters (11c). Slice 12 runs
every host proof on NaNVM built as a `.wasm`: the host (12a), a misuse's
text (12b), L1's native rows in Rust (12c) and the table that the loader
makes (12d). After them, the records pass and the number paths make
programs faster, and a program's module functions may call themselves.

## Map of this directory

|Module                                    |Holds                                                                  |
|------------------------------------------|-----------------------------------------------------------------------|
|[`types.ts`](./types.ts)                  |the data: types, terms, functions, modules, and the checker's answer   |
|[`.`](./module.f.js)                     |the constructors, and the facts about types that the stages share      |
|[`check`](./check/module.f.js)           |the checker: a type for every term, or the module refused with a reason|
|[`check/owned`](./check/owned/module.f.js)|the owned-stage check: each owned value consumed once on every path    |
|[`lifetime`](./lifetime/module.f.js)      |the lifetime pass: a module's plain stage to its owned stage           |
|[`print`](./print/module.f.js)           |the IR as text, for review and golden proofs                           |
|[`records`](./records/module.f.js)       |the records pass: an object only read back by its keys, split in locals|
|[`inline`](./inline/module.f.js)         |the inline pass: a function's body at each call that its hint asks for |
|[`wasm`](./wasm/module.f.js)             |the emitter, to the AST of [`fjs/media/wasm`](../media/wasm/README.md) |
|[`from_fast`](./from_fast/README.md)      |the lowering from normalized FAST, with the types from a table         |
|[`l0`](./l0/module.f.js)                 |the interfaces of L0 as data, and `any`, the type that they seal       |
|[`l0/host`](./l0/host/module.f.js)        |the `fjs:l0` imports as the L0 view's functions, over handles          |
|[`l0/host/count`](./l0/host/count/module.mjs)|a host of the `fjs:l0` imports that counts every value, for host proofs|
|[`l0/host/nanvm`](./l0/host/nanvm/module.mjs)|NaNVM's `.wasm` as the host of the `fjs:l0` imports, for host proofs|
|[`native`](./native/module.f.js)         |the interface of L1's native rows as data, `Native`                    |
|[`native/host`](./native/host/module.mjs)|a JavaScript host for the `fjs:l1-native` imports, over L1's rows      |

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
  [host](./native/host/module.mjs) calls
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
  The host calls it before anything else. It answers nothing: a program
  is called by its named exports, and L0 §20's `init`, which answers the
  main module's default export, is not built yet.
- **Constants on the host**: the [counting host](./l0/host/count/module.mjs)
  makes Any's four constants as their NaN boxes (checkpoint 4e), immutable
  globals of those bits, and keeps what `init` makes, since nothing drops a
  constant. Each call after `init` must leave every cell as `init` left it.
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

## What 6f adds

- **A read of an array at a number key**, `a[0]` or `a[Number(k)]`, by
  L1's `get` rules for that case: the integer of `u(31)` that the key
  holds, then `Containers.item` where it is less than the array's length,
  and `Any.undefined` where it is not, or where the key is a fraction, a
  NaN or an infinity; `-0` reads item `0`. Both answers are owned: the
  lifetime pass writes a `dup` of `undefined`. `exact` takes the term for
  a float that holds no integer, a trap unless it is given.
- **Only an array's** (until 10a): a receiver of any other kind was refused,
  since `get` throws for `undefined` and `null` and reads an object or a
  string by a string. Slice 10a opens those through L1's `get`. So was a
  member read that goes on to a call, until 11a lowers `o.f(x)` in a
  program.
- **L1's `typeOf`**, lowered from its text: `typeNames` is a constant that
  `init` builds, and `typeOf` reads it at `kind(v)`. It runs against L1's
  own on values of every kind, and four FunctionalScript functions of
  [`reads.f.js`](./from_fast/reads.f.js) run against themselves on the
  edges of floats. The random comparison reads its arrays too.

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

## What 8b adds

- **`buildArray(n, s, next, at)` of the L0 view, lowered**
  ([L0 design §22](../../doc/sasha-gil/wasm/l0-design.md#22-building-in-one-pass)):
  `begin_array` of `n`, which must hold an index exactly, then one `loop`,
  labelled `B0`, `B1`, … by depth, of the builder, the state and the count
  of items pushed. Each round pushes `at` of the state and, before the last
  item, steps the state by `next`, the view's order since 8a, and the
  round after the last seals the builder. No term is new.
- **Callbacks inlined**: `next` and `at` are arrow literals of at most one
  parameter, written in the call, and the lowering inlines their bodies
  where the loop reads them, so no closure is made. Any other callback is
  refused until slice 9, and so are a count that is not a number, a state
  of an integer range, in a record too, as a loop's parameter is, and an
  item that is not a value of `any`.
- **A throw inside a callback is refused**, since it would leave the
  builder, which is linear, behind. A call there that fails, of an
  exported function that throws say, abandons the builder, as a trap does,
  and the host's `recover` frees it.
- **`asArray`** is a cast to `array`, as `asString` is one to `string`.
- **Subjects**: the functions of [`builds.f.js`](./from_fast/builds.f.js),
  which build the units of a string, a value repeated `n` times where `n`
  may be no index, nested arrays and an array by a state that is a record,
  and two whose callbacks call functions that throw, which shows the
  view's order; and L1's `toIterable`, lowered from its text, against L1's
  own on values of every kind and on strings of code points. Each builds
  what its original builds and leaves nothing behind. The random
  comparison gains a form of `buildArray`.

## What 8c adds

- **Object builders**: Containers' `begin_object`, `push_property` and
  `seal` into an object
  ([L0 design §8](../../doc/sasha-gil/wasm/l0-design.md#8-containers-a-builder-handle-then-seal));
  `seal` answers an array or an object. Object literals of values of `any`
  lower to those; float records stay products.
- **`buildObject(n, s, next, keyAt, valueAt)` of the L0 view, lowered**:
  as `buildArray` is, of `begin_object`, `push_property` and `seal`, with
  arrow callbacks inlined and labelled `B0`, `B1`, … by depth. A key is a
  string; a value a value of `any`.
- **`asObject`** is a cast to `object`, as `asArray` is one to `array`.
- **`numberToString`**: L1's native row that object spread uses as an index
  key, an owned string from a float.
- **Subjects**: the functions of [`objects.f.js`](./from_fast/objects.f.js),
  which make records and Containers object literals, and L1's
  `objectSpread`, lowered from its text, against L1's own. A `{ ...v }`
  literal waits for a later cut; `objectSpread` is what it copies.

## What 9a adds

- **`from_f64` and `from_bool`**: Any's inverses of `to_f64` and `to_bool`,
  written where a float or a boolean meets `any`
  ([definition.md's rule 6](../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)).
  Array literals and builder items box them; float records stay products.
  Calling function values waits for 9b.

## What 9b1 adds

- **`code`**: a type, a pointer to a top-level function of the module, as an
  `i32` table index; `code(f)` is the term that names one.
- **`call_ref(c, …)`**: an indirect call of a code value. The emitter fills
  a module `funcref` table with every function that a `code` term names and
  spells the call as `call_indirect`. Hand-written only; L0's `call` /
  `make_function` and the lowering wait for 9b2 and 9b3.

## What 9b2 adds

- **`Functions.call(f, args)`**: borrows a function value and a sealed
  arguments array, answers the result owned, and may fail where the
  function throws. The counting host calls existing JavaScript function
  values (`any.only(function)`).
- **`Functions.make_function`**: the interface row
  ([L0 design §12](../../doc/sasha-gil/wasm/l0-design.md#12-functions-a-code-index-a-frame-a-length-and-a-text));
  a host that builds a function from an IR `code` waited for slice 11.
  Until 11b this host took the owned frame and text and trapped.

## What 9b3 adds

- **`asFunction(f)(…)` lowered** to L0 `call(f, args)` with an args array:
  Containers builds one from positional arguments, or a single spread of a
  known array passes that array. `asFunction` is a cast.
- **`find`, `text`, `join`**: Containers' `find` (as a float) and `join`,
  and Functions' `text`, on the L0 interfaces and the counting host.
- **Subjects**: L1's `toPrimitive`, `toNumber`, `toNumeric`, `toString` and
  `call`, lowered from L1's text over its error table.

## What 10a adds

- **L1's `get`**, lowered from its text over the runtime and its error
  table, run against L1's own: its throw for `undefined` and `null`, and
  its reads of an object or a string by a string.
- **A member or index of sealed `any`** is a call of the module's `get`
  where the signature table names it. 6f's array-at-number specialization
  stays. Without `get` in the table, that read is still refused. A member
  read that goes on to a call stays refused outside a program (11a).

## What 10b adds

- **Native bigint arithmetic and `bigintLess`**: `bigintAdd`,
  `bigintSubtract`, `bigintMultiply`, `bigintDivide` (may fail),
  `bigintNegate`, and `bigintLess` on the L1 native interface and host.
- **Subjects**: L1's `add`, `subtract`, `multiply`, `divide`, `negate`,
  `lessThan`, `greaterThan`, `lessThanOrEqual` and `greaterThanOrEqual`,
  lowered from L1's text over its error table, run against L1's own.

## What 10c adds

- **The whole L1 module**: every export of L1 lowered from its text as one
  module, `toPropertyKey` the last to join, as `toString` of its value.
- **The parity table**: each export runs against L1's own on the values
  and keys of
  [`l1/parity/proof.mjs`](../wasm/runtime/l1/parity/proof.mjs), from
  its [`testlib.mjs`](../wasm/runtime/l1/parity/testlib.mjs), a function
  among them: every pair for the binary operators and
  `strictEquals`, every value with each key for `get`. `divide` alone may
  abandon what it holds, where `Native.bigintDivide` throws.

## What copy variants add

- **An interface's copy variants**: a counted type may name some of its
  variants as copy, each once, as Any names `undefined`, `null`,
  `boolean` and (in the IR module) `number`. A value of a subset that holds
  only those, such as Any's constants, is used as a float is: the lifetime
  pass writes no `dup` and no `drop` of it, and the owned-stage check takes
  it where a parameter owns its argument.
- **The counting host** makes such values immediates: their NaN-box bits,
  which a `dup` or a `drop` leaves alone.

## What 11a adds

- **Untyped programs**: the [lowering](./from_fast/README.md#programs)
  takes a module that no table types, each export of `any` alone, and
  writes its operators, member reads, `?.` and calls of values of `any`
  as calls of L1's bodies, boxing a float or a boolean where it meets
  `any`.
- **`link`**: a program and the bodies of L1 that it reaches, by their
  `l1.` names, in one module, so one WASM module. Nothing new in the IR,
  the checker or the emitter: a linked name is a name of the module.
- **The host's judge**: where a program's twin, JavaScript itself, throws
  an error of its own, a `TypeError` say, the module must throw L1's value
  that names the same error ([`wasm/testlib.mjs`](./wasm/testlib.mjs)).

## What 11b adds

- **Closures**: in a program, a function as a value is
  `Functions.make_function` of code that the
  [lowering](./from_fast/README.md#closures) lifts, `(#self, #args) ->
  any`, and a frame of the captures that read values of the function
  around it. The code reads them by L0's new `Functions.frame(self, i)`,
  and its parameters as items of `#args`.
- **The table was exported**: a module whose `code` terms fill its table
  exported it as `table`, so the checker refused an export of that name,
  until 12d imported it.
- **The counting host's `make_function`** makes a JavaScript function that
  calls the module's code through that table, so `call` and JavaScript
  both call it, and its `frame` reads the frame.
- **The host's judge**: a function that a call answers agrees with its
  twin's where both have the same length and agree on probes of their own
  ([`wasm/testlib.mjs`](./wasm/testlib.mjs)).

## What 11c adds

- **Spread in a program**: `...v` in an array literal or in the arguments
  of a call is L1's `toIterable` of `v`, and in an object literal L1's
  `objectSpread` of it, each read where it stands, so that it throws where
  JavaScript throws before anything after it is read. Containers' builder
  then pushes every item of each part, in order, with a loop for each
  spread ([lowering](./from_fast/README.md#spread-and-rest-parameters)).
- **Rest parameters**: the rest parameter of a closure is an array of the
  items of `#args` past its other parameters, and that of a function that a
  call inlines an array of the arguments past them.
- **L0 gains `Containers.key(o, i)`**: it borrows an object and answers the
  owned key of its property `i`, which a spread of an object copies.

## What 12a adds

- **NaNVM as the host**: [`nanvm/l0-wasm`](../../nanvm/l0-wasm/src/lib.rs)
  is NaNVM's L0 ABI built as a `.wasm`, whose exports are a module's
  `fjs:l0` imports, so a module calls NaNVM with no JavaScript between.
  The [NaNVM host](./l0/host/nanvm/module.mjs) makes what NaNVM cannot
  export: Any's constants and `data_base`, a region that NaNVM's
  `reserve` gives. NaNVM runs a function's code index through an adapter
  module, a `call_indirect` into a table that the loader filled from the
  module's `table` until 12d, and a JavaScript function that a proof passes from an
  index past it.
- **Every host proof on NaNVM**: [`wasm/testlib.mjs`](./wasm/testlib.mjs)'s
  `onHost` swaps the host that `run` makes, and
  [`nanvm.test.mjs`](./l0/host/nanvm/nanvm.test.mjs) runs the emitter's,
  the lifetime pass's, FAST's and the random proofs on NaNVM. NaNVM counts
  handles, not references, so the judge there tells how many handles a call
  left over, not which. CI runs it after it builds the `.wasm`.

## What 12b adds

- **A misuse's text on NaNVM**: NaNVM's `.wasm` keeps what a panic said,
  which its `trap_text_length` and `trap_text_into` give, and the
  [NaNVM host](./l0/host/nanvm/module.mjs)'s `trap` reads it, so the judge
  compares a misuse's reason there, `l0.unit: not an index` say, as it
  does on the counting host.

## What 12c adds

- **L1's native rows in Rust**: the eleven `fjs:l1-native` functions are
  [NaNVM's](../../nanvm/lib/src/l0/abi/native.rs), computed by its own
  operators over its handles, and exported by
  [`nanvm/l0-wasm`](../../nanvm/l0-wasm/src/lib.rs), so on the NaNVM host
  a module calls them with no JavaScript between.
  [`nanvm.test.mjs`](./l0/host/nanvm/nanvm.test.mjs) compares them with
  JavaScript on random floats, texts and bigints.

## What 12d adds

- **The imported table**
  ([L0 design §5](../../doc/sasha-gil/wasm/l0-design.md#5-memory-and-table-made-by-the-loader-imported-by-both-modules)):
  the loader makes the table of code, as it does the memory. A module that
  imports an interface imports `table` and `table_base`, fills the table
  from `table_base`, and says in `fjs.layout` how many entries it needs.
  The NaNVM host's adapter calls into that same table, so nothing copies
  it.

## What the records pass adds

- **Records of `any` stay records**
  ([benchmark.md, lever 3](../../doc/sasha-gil/ir/benchmark.md#levers)):
  after [the lowering](./from_fast/module.f.js) links L1, the
  [records pass](./records/module.f.js) splits each object literal of
  values of `any` that its function builds and only reads back by keys
  that it has, a loop's state say, into a local for each value, so
  nothing builds it and L1's `get` looks nothing up. An object that
  leaves its function, is read by a key that it has not, or whose
  values would move past something that does something stays one.
  Hand-written IR in [its proofs](./records/proof.f.js), and programs run
  on both hosts against JavaScript in
  [`from_fast`'s host proof](./from_fast/proof.mjs).

## What the number paths add

- **A number is tested where it stands**
  ([benchmark.md, next lever 1](../../doc/sasha-gil/ir/benchmark.md#levers)):
  in a program, an arithmetic or relational operator of `any`, or of
  `any` and a float, matches each `any` once against `number`, reads it
  once with `to_f64`, and answers with the operator of the IR where all
  are numbers, boxed with `from_f64` where it is a float. Only otherwise
  does it call L1, where a float is boxed. `s.i < n` with `s.i` a float
  is 2 L0 calls, not 8. An operand that may hold no number, a bigint or a
  string say, calls L1 alone. `%`, `>>` and `&` take the same path, to
  L1's native rows of numbers, and so do `===` and `!==` where an operand
  is a float, as in `x === 1`, which `eq` answers: collatz below 30,000
  on NaNVM's `.wasm` went from 1.37 s to 0.66 s. `===` of two values of
  `any` calls L1 alone. The path is
  [`from_fast/numbers`](./from_fast/numbers/module.f.js).
- **`.length` of `any` is read in place**: in a program, `x.length` of a
  value of `any` that may be an array or a string matches it once and
  reads Containers' or String's `length`, and calls L1's `get` only for
  the other kinds, which would compare its key with `"length"` unit by
  unit. The read is [`from_fast/reads`](./from_fast/reads/module.f.js).
- **An arrow callback of `every` and `filter` is inlined**: in a program,
  `a.every(f)` and `a.filter(f)` of a value of `any` that may be an
  array, whose `f` is an arrow literal of at most three parameters,
  matches `a` once, and for an array is one loop with `f`'s body inlined,
  so no closure, no array of arguments and no call is made per item.
  `filter` marks each item on a mask, with `Any.null` or
  `Any.undefined`, which are copied for nothing, and then pushes the kept
  ones. Other receivers call L1 as before. Sort of 100,000 went from
  8.4 s to 2.5 s on NaNVM's `.wasm`, from 276M L0 calls to 99M. The loops
  are [`from_fast/callbacks`](./from_fast/callbacks/module.f.js).
- **A boxed number literal is made once**: a program's functions read
  each number that they box as `any`, as `l1.strictEquals(x, 1)` does on
  the slow path, from a constant of the module, `#n0` first, which `init`
  boxes once, instead of a `from_f64` and a `drop` at each use. The pass
  is [`from_fast/literals`](./from_fast/literals/module.f.js), and runs
  last.
- **A read of a split local is that local**: the records pass writes no
  `let` for a `let` of a read of a split object, so the lifetime pass
  copies nothing for it.

## What recursive helpers add

- **A module function that calls itself** (#4059): in a program, one that
  calls itself, not last, and that the module does not export is a
  function of the IR, `#h0`, `#h1`, … in the order of its definitions, of
  `any` alone, as an untyped export is
  ([lowering](./from_fast/README.md#functions-that-the-module-does-not-export)).
  It is lowered only where something calls it. Outside a program the
  refusal stays.

## What the bit operators add

The first step of the runtime written in the IR
([runtime-in-ir.md](../../doc/sasha-gil/ir/runtime-in-ir.md), checkpoint 2),
which reads and builds a NaN box:

- **`and`, `or`, `xor`, `shl` and `shr`** of two unsigned integers, each
  one WASM instruction in the word it runs in. The range is exact: `and`
  within the smaller bound, `or` and `xor` within the ones of the larger,
  and a shift, by a count below 64, at both ends, so `shl` is refused
  where its result needs more than one word, as `mul` is. `shr` is the
  logical shift. A signed operand is refused.
- **`to_bits(x)`**, the 64 bits of an `f64c` as a `u(64)`, and
  **`from_bits(b)`**, the float of an unsigned integer's bits, an `f64`,
  since the bits may be any NaN: `i64.reinterpret_f64` and
  `f64.reinterpret_i64`.
- **`canon(x)`**, a float with any NaN replaced by the one NaN,
  `0x7FF8_0000_0000_0000`: an `f64c`, so `to_bits(canon(x))` reads the
  bits of any float the same on every target. It keeps the float in a
  local and `select`s the one NaN where the float is not equal to itself.

The `bits` module of [`testlib.f.js`](./testlib.f.js) runs each of them
against JavaScript's `&`, `|`, `^`, `<<`, `>>` and a `DataView`.

## What a module that defines its types adds

Checkpoint 4c of the runtime written in the IR: the module that implements
a sealed type, as Any's own module will implement `any`, sees the bits
that carry its values.

- **`defines`**: a module may name the sealed types that it implements,
  under the name that their type terms carry, `['sealed', name, type, v]`,
  with each type's variants and carrier as an interface gives them. The
  function that a type's `kind` names is the module's own, so a `match`
  calls `self`, and another module makes its literals. The module does not
  import that name, nor call it but as `self`.
- **`unseal(v)`**, the bits of a value of a type that the module defines,
  `u(64)` for an `i64` carrier and `u(32)` for an `i32`, and
  **`seal(t, b)`**, a value of `t` from bits within them. Both are no
  instruction at all: the value and its carrier's bits are one WASM value.
  The checker refuses both in any other module, so a program still sees
  `any` only through Any's functions.

The `sealing` module of [`testlib.f.js`](./testlib.f.js) defines Any and
runs on NaNVM's `.wasm`, against NaN boxes laid out as Sergey's README
lays them out; `tagging` answers a `match` with a `kind` of its own.

## What a counted type that a module defines adds

Checkpoint 4d-1, as
[defined-hooks.md](../../doc/sasha-gil/ir/defined-hooks.md) sets it out: a
type that a module defines may be counted, with a `dup` and a `drop` of its
own that work on its carrier's bits, so that neither ever holds a value of
the type and the lifetime pass never writes a hook inside a hook.

- **The hooks**: a counted type names both, each a function of the module
  of one borrowed parameter of its bits, `dup` as `(b: u(64)) -> u(64)`
  and `drop` as `(b: u(64)) -> unit` for an `i64` carrier, and only a
  counted type names copy variants. The checker refuses a hook that may
  fail, since the pass writes the hooks after the effects are inferred.
- **`release(x)`**, the bits of an owned value, which it takes over, as a
  parameter that owns its argument does. It is no instruction.
- **Only the lifetime pass writes them.** It copies a borrowed `e` of
  such a type as `seal(t, self.dup(unseal(e)))`, `t` the type of `e`, and
  drops an owned `x` as `self.drop(release(x))`. The checker refuses these
  forms in the plain stage, and in the owned stage it takes them in that
  shape only: a call of a hook, a `release`, and a `seal` of a variant
  that is not copy are refused anywhere else, since bits are copy and the
  owned check cannot follow them. A `seal` of copy variants stays the
  module's to write, and so do two more forms of a `seal` of a counted
  type that the module defines, in both stages:
  - **a new owner**, `seal(t, f(…))` or `seal(t, or(c, f(…)))` with `c`
    a literal, where `f` is marked `counts: 'new'`: bits of a value that
    no one owns yet, as the Heap's `alloc` answers a new block, so the
    `seal` makes its one owner, and the owned check follows it from
    there. Such bits are an 8-aligned address, so `c` sets none of the
    bits from 3 to the top of `f`'s word, which the address may hold, and
    the checker refuses a `c` that does. A call of such an `f` anywhere
    else is refused, and the marker takes only a signature that answers
    one word of bits, `u(64)` or `u(32)`, and does not fail.
  - **bits that hold no address**: literals and integers of 16 bits at
    most, joined by `or` and `shl`, as a short string's box is made of
    its units. Other bits, such as an `unseal`'s whole or a `u(64)`, are
    refused, since they may be an owner's. The checker sees only an
    integer's range, not where it came from, so it trusts the module
    that each such integer is a code unit or a tag, not a piece of an
    address: a 16-bit piece of an `unseal`'s bits, as `firstUnit` takes
    from a short box, passes, and so would pieces of a long string's box
    put back together. The debug arena then traps the second owner's
    `drop`, on a count of 0 or a second `free`.

- **`Ref`**, in [`l0/module.f.js`](./l0/module.f.js): NaNVM's
  `kind_ref`, `dup_ref`, `drop_ref` and `same_ref` over a reference's
  bits, which NaNVM's host already passes through as `fjs:l0` imports. A
  signature that counts on bits says so, `counts: 'dup'` or `'drop'`
  (`countsBits`), as `dup_ref` and `drop_ref` do. The checker takes the
  marker only on a signature that fits it: one borrowed word of bits,
  `u(64)` or `u(32)`, a `dup` that answers bits of that word and a `drop`
  that answers `unit`, neither of which fails. The printer writes the
  marker after the signature: `fn dup_ref(b: u(64)) -> u(64) counts dup`.
- **Only a hook calls a function that counts on bits**, the hook of its
  name, and only as its last term: the checker refuses a call of one
  anywhere else, so that a `dup` answers the bits that `dup_ref` gives and
  a `drop` gives one up at most once on each path. What it cannot see is
  whether a hook tells a reference from other bits rightly: the hooks are
  the module's trusted base, and NaNVM's leak check proves them.

The `counting` module of [`testlib.f.js`](./testlib.f.js) defines a counted
`C.cell` whose hooks give the bits back and do nothing, so its owned stage
runs on any engine. `referencing` defines a counted `R.ref` whose hooks
count a NaN box's reference through `Ref` and pass any other box through,
as Any's do; it runs on NaNVM's `.wasm`, which finds no live handle
after it.

Checkpoint 4d-2: [`runtime/any`](./runtime/any/module.f.js) is Any itself
in the IR — `isRef`, `kind`, hooks, the scalar conversions, `same`, and the
four constants, with `number` among the copy variants. Its proofs check the
module; the NaNVM host proves it against L0 on the same boxes. Checkpoint
4e links it into programs (`linkAny` after L1's `link`), moves the counting
host to NaN boxes, and remeasures the IR benchmarks.

Short strings: [`runtime/string`](./runtime/string/module.f.js) is the
String runtime-module (manifests A/B/C, pack/unpack helpers); S2 teaches
the host/NaNVM ABI to accept and emit short boxes; S3's `linkString`
merges B IR `length`/`unit` after `linkAny` (long miss still imports);
S4 remeasures `shortOps` / `repeat` under emit B in
[benchmark.md](../../doc/sasha-gil/ir/benchmark.md)
([short-strings.md](../../doc/sasha-gil/ir/short-strings.md)).

## What L0's Memory adds

The first step of the IR's heap, H1
([heap.md](../../doc/sasha-gil/ir/heap.md#memory-in-the-ir)): memory at
the low level, as an interface whose functions are the target's own
instructions.

- **`Memory`**, in [`l0/module.f.js`](./l0/module.f.js) beside `l0`,
  not in it: `load8` to `load64` take an address, a `u(32)`, and answer
  a `u(8)` to a `u(64)`, the low byte first; `store8` to `store64` take
  an address and a value and answer `unit`; `copy(to, from, n)` writes
  the `n` bytes at `from` to `to` as they were before, so the two may
  overlap; `size()` answers the memory's size in 64 KiB pages, and `grow(n)` adds `n` pages and
  answers the size before, or `-1`. None may fail: an address past the
  memory traps, which is a misuse, as a bad reference is to `Ref`.
- **An interface that says `instructions`** is bound by the target, not
  by a host, and the checker takes only `Memory`, or a part of it under
  any name, of its ABI, with no types and no constants, and each function
  with `Memory`'s signature and marks. A host makes a literal, so a
  function of such an interface makes none. The printer writes the flag
  after the ABI: `import Memory from fjs:l0, instructions`.
- **The emitter writes each call as its instruction**, at natural
  alignment and no offset: `i32.load8_u` to `i64.load`, `i32.store8` to
  `i64.store`, `memory.copy`, `memory.size` and `memory.grow`. It imports no function
  and no constant for the interface, and imports the loader's memory
  from its ABI, with a `fjs.layout` of no bytes where the module has no
  literals. A module imports one memory, so the checker refuses one
  whose literals are made in another ABI's, and a constant or a function
  of Memory's ABI named `memory`. The table comes from the first
  interface that a host binds, so a module of Memory alone keeps its own.
- **Its calls keep their place.** A store answers `unit`, which nothing
  reads, and must stay. No pass moves, removes or merges a call today:
  the inline pass copies a body with its calls in order, the records pass
  moves nothing past a call, and the lifetime pass adds only `dup`s and
  `drop`s. A proof runs a store through all three. The first pass that
  moves calls brings the checker's inference of Memory's effect.

The `addressing` module of [`testlib.f.js`](./testlib.f.js) stores and
loads each width and reads the low 16 bits of 64, each call in a page
that it grows for itself, and answers how much `grow` changes the size.
So it holds on either host's memory: the counting host's, and NaNVM's,
whose stack takes the memory's start.

## What a trap on misuse adds

The first part of H2, the IR's heap
([heap.md, open question 3](../../doc/sasha-gil/ir/heap.md#open-questions)):
a trap that the checker does not count as failing, as
[L0 design §11](../../doc/sasha-gil/wasm/l0-design.md#11-misuse-traps-and-only-calls-fail)
tells misuse from failure.

- **`misuse(reason)`**, in [`module.f.js`](./module.f.js), is a `trap`
  marked `misuse`, `['trap', reason, 'misuse']`. It stands where only a
  bug of the caller leads, or memory that cannot grow, and it traps as
  `trap` does: the emitter writes an `unreachable`, and every pass keeps
  the term as it is.
- **The checker does not count it.** A function whose only traps are on
  misuse may not fail, and neither may a call of it, so a hook may hold
  one, as a heap's debug `drop` will on a count of 0.
- **Any's `kind` may not fail.** Its trap on forged bits is a misuse, so
  no function of either of Any's variants may fail, as its interface says
  of each; before, the plain `kind` failed and the checked one, which asks
  NaNVM's `kind_ref`, did not.
- **The printer writes it as its builder**: `misuse('count of 0')`.

## What flow refinement adds

The second part of H2, the IR's heap
([heap.md](../../doc/sasha-gil/ir/heap.md#order-of-work)), whose pointers
are sums of `u(32)` values that a check fits back into 32 bits: rule 2 of
[type-system.md's flow refinement](../../doc/sasha-gil/ir/type-system.md#flow-refinement-is-two-rules),
which `narrow` and `clamp` will be written with.

- **A branch on a comparison narrows its operands.** In each arm of a
  `match` of `lt`, `le` or `eq` of two integers, an operand that is a local
  has the range that the other operand's allows: after `lt(i, n(10n))`,
  `i: u(8)` is `int(0, 9)` in the true arm and `int(10, 255)` in the false
  one. An `eq` that holds leaves both in their overlap, and one that does
  not takes the other's one value off an end: in the false arm of
  `eq(w, n(0n))`, a `w: u(64)` is at least 1.
- **So does a branch on its negation**: a `match` of a bool whose arms
  answer bool literals, as `not` and `ne` write one, passes on what the
  outcomes of its own operand teach.
- **Nothing else narrows.** The checker keeps one range per local and
  nothing that relates two locals, so after `lt(i, k)` it knows the range
  of each, not that `i` is below `k`. An operand that is no local, a float
  and an arm of both outcomes narrow nothing, and neither does a range that
  would be empty, which no run reaches.
- **The emitter reads a narrowed local in the narrower word.** A local
  keeps the word of the type that it was bound at, and where its range
  now fits 32 bits, a read of an `i64` local is followed by an
  `i32.wrap_i64`, which keeps its value.

The `narrowing` module of [`testlib.f.js`](./testlib.f.js) fits a sum of
two `u(32)` back into one, reads a `u(64)` below 2^32 as a `u(32)`, a
count that is not 0, and an `i(64)` from -5 to 5, and the host proof runs
it against its twins.

## What the bump arena adds

The third part of H2, the IR's heap
([heap.md](../../doc/sasha-gil/ir/heap.md#the-bump-arena)): the Heap
interface and its release variant, written in the IR's eDSL over L0's
`Memory`, in [`runtime/heap/module.f.js`](./runtime/heap/module.f.js).

- **The interface** is `alloc(t, n)`, a block of `n` bytes, 8-aligned, for
  an object of type `t`; `dup(p)` and `drop(p)`, which answers whether the
  caller must release what the block holds; and `free(p)`, after the
  release. An address is a `u(32)`, and a size is at most `0xFFFF_FFF8`.
- **The release arena keeps no header.** `alloc` rounds the size up to 8,
  moves the pointer past the block and answers where it was. `dup` does
  nothing, `drop` answers `false`, and `free`, which only a release calls,
  traps on misuse.
- **Its state is a page that `init` grows the memory by.** The constant
  `state` keeps where the page starts, and its first words hold the
  pointer and the end of the pointer's region. The first blocks start 16
  bytes in.
- **A full region grows the memory** by the larger of the request and 16
  pages, or by the request alone where the host refuses that or 16 pages
  would end past the last page. New pages that follow the region extend
  it, so a region that ends where the memory does asks only for the bytes
  past its end, and elsewhere, where another allocator grew the memory in
  between, they start a new region.
- **No byte of the arena is past `0xFFFF_0000`**, so every address and
  every end fit 32 bits, which flow refinement proves: the sum of the
  pointer and a size is a `u(32)` again where it is at most the end.
  Memory that cannot grow, or would reach past that, traps on misuse: out
  of memory.
- **A plain FunctionalScript [model](./runtime/heap/model/module.f.js)**
  keeps what the arena keeps in its state words, and the
  [host proof](./runtime/heap/proof.mjs) runs seeded sequences of
  allocations of every size on both, with another allocator growing the
  memory between them. Every address must be the model's, no block may
  overwrite another or the state, and memory that runs out must trap
  where the model runs out.

## What the debug arena adds

The last part of H2
([heap.md](../../doc/sasha-gil/ir/heap.md#the-bump-arena)): the arena's
debug variant, `counted`, beside `module` in
[`runtime/heap/module.f.js`](./runtime/heap/module.f.js), which a runtime
will pick when it links, as `lower` picks Any's `checked` where its
runtime says `checkedKind`. Nothing links a heap yet: its first client is
H3.

- **16 bytes before each block.** A size word holds the size that `alloc`
  was asked for in its low half, so that a region can be walked in birth
  order, and 1 in its high half once the block is freed. The header word
  after it is the one that
  [every counting variant shares](../../doc/sasha-gil/ir/heap.md#what-every-counting-variant-shares):
  the count in bits 0 to 31, 1 at first, and the type `t` in bits 40 to
  47. The class and the tag stay 0, since no block is reused.
- **`dup` adds 1, and `drop` takes 1** and answers `true` at 0; `free`
  marks a block whose count is 0. No block is reused, so a stale
  reference finds a count of 0 and traps.
- **`live()`** answers how many blocks have a count above 0, from a third
  state word, for balance checks.
- **A bitmap of block starts.** Each page that a region holds has a KiB of
  bitmap, a bit for each 8 bytes, which `alloc` sets where a block starts.
  A region keeps its pages' bitmaps in its tail and ends where they start,
  so it takes a page more for each 32 that its block needs, and is always
  new. The directory, four pages after the state's that `init` takes,
  holds the address of each page's bitmap, or 0. A check costs two loads,
  and the release arena none.
- **Every misuse traps**: an address that is not 8-aligned, is below the
  first block, or whose bit is not set, as inside a block, in a region's
  tail, in a page that no region holds or past the pointer, though what is
  there reads as a header; a `dup` or a `drop` of a count of 0; a `free`
  of a block whose count is above 0, or a second `free`; and a count or
  `live()` that would pass 32 bits, which no run reaches.
- **The fast path checks the pointer**, which is never past `0xFFFF_0000`,
  so that the block after its 16 bytes is a `u(32)`: one compare more,
  beside the stores of the two words and of `live`.
- **Both variants grow alike.** One pair of functions grows a full region,
  given the pages that a request needs and how the new pages become a
  region, and a request that needs more pages than a region holds is out
  of memory. The release arena's code is as it was.
- **The model keeps each block by its address**, with its size, type,
  count and whether it was freed. The
  [host proof](./runtime/heap/proof.mjs) runs seeded sequences of
  allocations, `dup`, `drop` and `free` on both: every address, every
  header and `live()` after every step must be the model's, every step
  that the model refuses must trap, and a walk of the size words must
  reach every block in birth order, but where a new region starts, and
  end at the pointer. The record at each region's start that leads a walk
  to the next region
  ([heap.md](../../doc/sasha-gil/ir/heap.md#where-the-heap-keeps-its-state))
  comes with H4's recount, the first walk of every block.

## What IR references in Any add

H3a, the first part of long strings in the IR heap
([long-strings.md](../../doc/sasha-gil/ir/long-strings.md#steps)): Any
learns the box of a reference into the IR heap, and its hooks count one
through the Heap, in two variants beside `module` and `checked` in
[`runtime/any/module.f.js`](./runtime/any/module.f.js). No program links
them yet: H3d links the heap.

- **The box** of a long string in the IR heap is
  `0x7FF9_0000_0000_0002 | p`, a reference whose kind nibble is 9 and
  whose bits 3 to 31 are its block's address.
  [`runtime/box`](./runtime/box/module.f.js) has its bits, its test, and
  the block's address as a term.
- **`withHeap`** reads nibble 9 as a string's, kind 4, with no call, as it
  reads NaNVM's nibbles. Its hooks test the nibble with one mask and one
  compare inside the test for a reference: an IR string goes to the
  Heap's `dup`, or to its `drop` and then to its `free` where the drop
  answers that the count reached 0, since a long string holds no
  reference. Every other reference counts through `Ref` as before. It
  imports the Heap interface.
- **`checkedWithHeap`**, for a debug build, refuses a box with any bit
  but its tag's and its block's, and asks the debug arena's new `type_of`
  for the block's type, whose high nibble must be a string's kind, in its
  `kind` and in its hooks before they count, so a forged box traps and
  changes no count.
  `type_of` traps where the address names no block or the count is 0, as
  NaNVM's `kind_ref` checks a handle. It imports the debug arena's
  interface: the Heap's, with `live` and `type_of`.
- **The host proof** ([`runtime/any/proof.mjs`](./runtime/any/proof.mjs))
  compiles Any and an arena each from the IR, and joins them through the
  Heap's imports on the host's engine, the arena on a memory of its own.
  On the release arena the hooks pass an IR string. On the debug arena
  they count it in its header down to the `free`, and a freed block takes
  no more owners. The checked variant refuses a freed block, a block of
  another type and a box with stray bits, which the plain one reads as a
  string. On both, the host's own references count as before and leave
  no cell over, and [NaNVM's test](./l0/host/nanvm/nanvm.test.mjs) runs
  the same with NaNVM as the host.

## What long strings in the IR add

H3b, the second part of long strings in the IR heap
([long-strings.md](../../doc/sasha-gil/ir/long-strings.md#steps)):
String's `length`, `unit`, `concat` and `substring` over the three forms
of a string, in `withHeap` in
[`runtime/string/heap.f.js`](./runtime/string/heap.f.js). No program links
it before H3d.

- **A long string's block** is a `u32` length, then its UTF-16 units, of
  type `0x40`, so that its box is `0x7FF9_0000_0000_0002 | p`. The module
  makes one as `seal(string, or(IR_STRING, Heap.alloc(0x40, n)))`, since
  the Heap's `alloc` counts new.
- **The IR's own results are short or in the IR heap.** `concat` of two
  strings that are short or in the IR heap, and `substring` of one,
  answer a short box where the result has 2 units at most, as NaNVM's emit
  policy B makes one, and a new block otherwise, whose units `Memory`'s
  new `copy` writes, or the stores of a short box's units. An empty
  operand of `concat` answers the other, and a `substring` of every unit
  answers the string itself.
- **NaNVM's strings stay NaNVM's.** Where an operand of `concat` is
  NaNVM's, an IR operand is copied into a NaNVM string by L0's new
  `Units.make_string(p, n)`, as at a crossing, and L0's `concat` joins
  them. NaNVM's `make_string` reads any bytes of the memory, as the owner
  chose, while its writes still need a reserved region.
- **The proofs.** A FunctionalScript model of the forms,
  [`runtime/string/model`](./runtime/string/model/module.f.js), says what
  each function answers and in which form. The host proof
  ([`heap.proof.mjs`](./runtime/string/heap.proof.mjs)) compiles String
  and Any with an arena each from the IR, runs explicit cases and five
  seeded runs of 400 steps against the model on the release and the
  debug arena, and checks each result's form, units and block, and that
  every block is freed at the end. NaNVM's test runs it with NaNVM as the
  host.

## What every slice refuses

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
in the ABI of an interface that makes literals, or `table` or
`table_base` in the first interface's ABI, an `own` parameter of a
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

Each module's `proof.f.js` holds its golden texts and every refusal, over
the hand-written modules of [`testlib.f.js`](./testlib.f.js).
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
functions themselves, the L1 functions that the slices name among them.
