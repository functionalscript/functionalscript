# From normalized FAST

The lowering of the second to the fifth slices
([todo/slices.md](../todo/slices.md)): a FunctionalScript module's
normalized FAST, as [`edag/to_fast`](../../edag/to_fast/README.md) makes it,
to a module of the [IR](../README.md), for the part of the language that
the first slice admits, for values of unknown kind, which the third reads
through the L0 view, for the loops that the fourth adds, and for the
functions that the module does not export, the records and L1's native
rows that the fifth adds. It reads FAST before
[preparation](../../js/ast/prepare/README.md) adds mutable slots, as
definition.md's
[open question 2](../../../doc/sasha-gil/ir/definition.md#open-questions)
recommends, and as the owner chose to assume on 2026-11-13.

```js
import { unwrap } from '../../types/result/module.f.js'
import { check } from '../check/module.f.js'
import { f64, signature } from '../module.f.js'
import { lower } from './module.f.mjs'
import { sourceOf } from './testlib.f.mjs'

const { fast, imports } = unwrap(sourceOf('export const max = (a, b) => a < b ? b : a'))
const ir = unwrap(lower({ max: signature([['a', f64], ['b', f64]], f64) })(fast, imports))
const checked = unwrap(check(ir))
```

## Types come from a table

FAST has no types, so the lowering takes a signature for each exported
function that it lowers, by its name: the names and types of its
parameters and the type of its result, as a TypeScript signature has them.
A `number` is an `f64`, a `boolean` a `bool`, a `bigint` the integer range
that its signature gives it, and a value of unknown kind `any`, which
[L0](../l0/module.f.js) seals; the checker then finds the range of every
result and refuses one wider than a word. A `number` is never an integer
range in these slices.

The table also chooses what to lower. The lowering reads a module's
functions, not its evaluation: of everything else that the module defines,
it reads only what a function that it lowers reads, so L1, which exports
far more, gives the five functions that the slices name so far:
`toBoolean`, `stringEquals`, `stringLess`, `strictEquals` and
`stringIndex`.

## What it lowers

| Normalized FAST | The IR |
| --- | --- |
| an exported function that the table names, or a module definition of one | a function, named by its export |
| `define`, `required`; a `block` or an `if` statement of one result | a `let`, of a local named `#0`, `#1`, … by how many locals enclose it; a binding of a local is that local, and a `let` whose body is only its local is its value |
| `['if', c, a, b]`, `?:` | `if_(c, a, b)`: a `match` of a `bool` |
| `['block', b]` | the block's statements as `let`s around its exit's value; a statement that never completes ends the block |
| `return` | the body's value in the tail of a function, and `return_` elsewhere |
| a `loop` statement | a `loop`, labelled `L0`, `L1`, … by how many loops enclose it, whose parameters are locals named as `let`s are |
| `continue` | `next(label, fields)`: a `br` to the loop, anywhere in its body |
| `break`, where it ends the loop's body | the loop's value |
| a call of a function that the function defines, or that the module does not export | its body, inlined where the call stands |
| an object literal of names and values, `{ i: 0, value: 0 }` | a record: a `make` of its keys in their order, `{ i: 0.0, value: 0.0 }` |
| `r.k` | `field(r, 'k')`, printed `r.k`; the field's own term where `r` is a record made there whose other fields do nothing |
| a `number`, a `bigint`, a `boolean` | a `lit` of `f64c`, a `lit` of its own range, a variant of `bool` |
| `+`, `-`, `*`, `/`, `<`, `<=` | `add`, `sub`, `mul`, `div`, `lt`, `le` |
| `a % b` of two floats | `Native.numberRemainder(a, b)`, [L1's native row](#l1s-native-rows) |
| `a > b`, `a >= b` | `lt(b, a)`, `le(b, a)`, with `a` bound to a local first where it does something |
| `a === b`, `a !== b` | `eq`, `ne` of numbers; of two booleans, `if_(a, b, not(b))` and `if_(a, not(b), b)` |
| `-x` | `neg(x)` of a float, `sub(0, x)` of an integer |
| `!x`, `Number(x)` | `not(x)` of a `bool`; `float(x)` of an integer, and `x` of a float |
| `Math.sqrt(x)`, `Math.abs(x)` | `sqrt(x)`, `abs(x)` |
| a call of an exported function, or of the function itself | a `call` of `self` |

## Functions that the module does not export

A function that the module does not export has no signature in the table,
so the lowering inlines it at each call, as it inlines a function inside a
function, which the owner chose on 2026-11-13. Each copy is typed by what
its call gives: in [`helpers.f.js`](./helpers.f.js), `twiceInt` takes a
`u(8)` at one call and a `u(16)` at the next. Its captures are what the
module's bindings are: a function that the table names is a `call` of
`self`, a name of the runtime is itself, and another function that the
module does not export is inlined in its turn. L1's `stringIndex` reads
`digit` so.

A function that calls itself, by its own name or through others, would be
inlined forever, so it is refused; normalized FAST has already made a loop
of one that calls itself in its tail. The other reading of the slice, a
function of the module typed once from its call sites, would need its calls
to agree on their types, and no note settles how.

## Records

An object literal whose entries are names and values is a record: a
product of its keys in their order, `make` in the IR, and `r.k` is a
`field` of it. A record stays in its function, as a local, a loop's
parameter or the value of a branch: the checker refuses a product in a
signature, so a function that returns a record is refused, and one that
takes one is inlined, where `p.x` of a record made at the call is the
field's own term. L1's `stringIndex` keeps the state of its loop in a
record:

```js
let r = { i: 0, value: 0 }
while (r.i < n && r.value >= 0) {
    const d = digit(unit(s, r.i))
    const value = d < 0 ? -1 : r.value * 10 + d
    r = { i: r.i + 1, value: value > 0xffff_ffff ? -1 : value }
}
return r.value
```

```
(
    loop L0 (#1: { i: f64, value: f64 } = { i: 0.0, value: 0.0 })
        …
        br L0 { #1: { i: add(#1.i, 1.0), value: if lt(4294967295.0, #3) then -1.0 else #3 } }
    …
).value
```

A loop's parameter that is a record widens each float field to `f64`, and
is refused where a field is an integer range. Two records of the same keys
in another order are of two types, which no one type holds, so
`c ? { x: a, y: 1 } : { y: 1, x: a }` is refused.

## Loops, and functions inside functions

Normalized FAST makes a function of each loop of the source and calls it
once, and a call of a function itself in its tail is a loop already. The
lowering inlines a function inside a function at each call: its parameters
stand for the arguments, a term that does nothing as itself, such as a
local, a literal or a record of them, and anything else bound to a local
first, in their order; its captures stand for what they read where the
call stands; and the `return` that ends its body is its
value. [definition.md's rule 5](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)
lifts such a function to the module instead. Inlining needs no closure
conversion and no new function, and is exact, since the function reads
nothing but its parameters and its captures, which stand for the same
values where it is called; it gives one copy of the body for each call.

Each argument is lowered where it stands, after the locals of the
arguments before it are bound, so the locals that it binds itself are
named past them: in `mid(a + 1, sq(b + 1))`, `a + 1` is `#0`, and the
locals of `sq(b + 1)` start at `#1`. The arguments of `unit`, of `same`
and of a native row are lowered so too.

The normalization puts a definition that only one function reads in a
block around that function: a `const` that only a loop reads, or an import
that only one function of the module reads. The lowering reads the
function past such blocks, and their statements stand where the function
is defined, as locals of the function around it or as bindings of the
module.

```js
export const steps = a => {
    const limit = a * 2
    let i = 0
    while (i < limit) { i = i + 1 }
    return i
}
```

```
fn steps(a: f64) -> f64 =
    let #0 = mul(a, 2.0)
    loop L0 (#1: f64 = 0.0)
        if lt(#1, #0) then br L0 { #1: add(#1, 1.0) } else #1
```

A loop's parameters are locals of the types of their first values, a float
widened to `f64`, since a later round may give any float, and so is each
float of a record. An integer range
is refused, since no bound holds what a later round may give it. JavaScript
counts with numbers, so a loop's counter is an `f64`, and `unit` reads the
integer that it holds exactly.

```js
export const f = a => {
    let i = 0
    while (i < a) { i = i + 1 }
    return i
}
```

```
fn f(a: f64) -> f64 =
    loop L0 (#0: f64 = 0.0)
        if lt(#0, a) then br L0 { #0: add(#0, 1.0) } else #0
```

Normalized FAST keeps the variables of a loop of more than one in an
array, which waits for the slice of builders, so such a loop is refused; a
record of them, as `stringIndex` keeps, is one variable.

## The L0 view

The caller names the runtime, the specifiers by which the module imports
the [L0 view](../../wasm/runtime/l0/module.f.js) and
[L1's native rows](../../wasm/runtime/l1/native/module.f.js), since the
lowering resolves no path, and the module then imports
[the interfaces of L0](../l0/module.f.js) and
[of the rows](../native/module.f.js). Every function of the view that it
reads takes a value of `any` first.

| The L0 view | The IR |
| --- | --- |
| `kind(v)` | `float(Any.kind(v))` |
| `UNDEFINED`, `NULL`, …, `FUNCTION` | the tag, a `lit` of `f64c` |
| `asBoolean(v)`, `asNumber(v)`, `asString(v)` | a `cast` of `v` to `boolean`, `number` or `string`, whose arm calls `Any.to_bool` or `Any.to_f64`, or is `v.string`, and a trap for the other kinds; `v` itself where it holds no other kind, and refused where it never holds the kind |
| `length(v)` | `float` of a `match` of `v`: an arm for each module of L0 that has a `length`, and a trap for the kinds that none takes; a call where one module takes every kind that `v` holds, `String.length(v.string)` |
| `unit(s, i)` | `float` of a `cast` of `s` to `string`, whose arm reads the integer of `u(31)` that `i` holds, with `exact`, and calls `String.unit`; it traps (`'inexact'`) where `i` holds none |
| `same(a, b)` | a `cast` of each to `array`, `object` and `function`, named `a.same`, around `Any.same(a.same, b.same)` |

JavaScript reads a tag and a length as numbers, so each is a float, and
the operators on them are a float's: L1's `kind(v) === NUMBER` is
`eq(float(Any.kind(v)), 3.0)`. An arm names the operand at its kinds after
the operand and the kind, `v.number`, or after the module of L0, as
`length`'s arms do: `v.string`. Where the operand is no local, the
function's name stands for it. JavaScript reads both arguments of `unit`
before it casts the string, so each that does something is bound to a
local first, in their order.

A cast narrows the rest of its block, as
[definition.md's rule 4](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)
says. Where the first thing that a definition does is a cast of a local
that holds other kinds too, `asString(a)` say, a `cast` of that local wraps
the definition and the rest of the block, which read the local as
`a.string`: a cast of it there is the value itself, and its `length` is
String's. L1's `const n = length(asString(a))` narrows `a` so for the rest
of `stringEquals`. A cast after something else that the definition does
narrows nothing, since that would move the cast's trap before it.

A cast of a value that never holds its kind would always trap, so it is
refused with the kinds that the value holds: `asNumber` of a local that
`asString` has narrowed is `asNumber of any.only(string): asNumber takes a
number`. So are `unit` of a value that is never a string, and `length` of
one whose kinds have none.

## L1's native rows

A row's arguments are cast to the kinds that it takes, as `unit`'s string
is: `bigintEquals(a, b)` of two values of `any` is a `match` of `a` to
`bigint`, then of `b`, around `Native.bigintEquals(a.bigint, b.bigint)`.
JavaScript reads every argument before the row checks any, so an argument
that does something is bound to a local first, in their order; a local
that two arguments read is cast once, and one that holds no other kind is
not cast. L0's `same` is cast in the same way.

`%` of two floats is the row `numberRemainder`, since WASM has no
instruction for it: L1's `numberIndex` tests `n % 1 === 0`, which is
`eq(Native.numberRemainder(n, 1.0), 0.0)`. A module lowered without the
runtime imports no row, so it refuses `%`, and `%` of integers is refused
as their division is.

## Operators

Where JavaScript has one operator for two types, the operand's type picks
the IR's: the lowering asks the [checker](../check/module.f.js) for it,
with `typeOf`, in the scope where the term stands. FAST has no `&&`, `||`
or `??`: they reach it as conditionals.

`a > b` is `lt(b, a)` and `a >= b` is `le(b, a)`. Where `a` does
something, it is bound to a local first, so that it is still done before
`b`: either may trap, as a cast does, and a loop may never end.

## What it refuses

Everything else, with the function's name and the reason
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)):
an import other than the runtime's, among them a JSON module, a function of
the view other than these seven, a cast of a value that never holds its
kind, a native row other than `bigintEquals` and
`numberRemainder`, a module constant that a lowered function reads, an
exported function that the table does not name, which a lowered function
calls, a function as a value, a function that calls itself or whose call
gives another number of arguments than it takes, a loop of more than one
variable, a loop parameter of an integer range, in a record too, a `break`
that does not end its loop's body, a `return` inside a loop or before the
end of a function that is inlined, an entry of an object that is not a name
and its value, such as a spread, a member read of anything but a name,
`?.`, `throw`, a `lazy` definition, a string, `null`, `undefined`, a rest
parameter, a spread argument, a statement of no result or of several, `%`
of integers, or in a module lowered without the runtime, and every
operator not in the table, such as `**` and the bitwise ones. The
[checker](../check/module.f.js)
then refuses what the IR does not admit, such as a condition that is not a
`bool`, integers mixed with floats, a division of integers, or a record
that leaves its function.

## Proofs

- [`proof.f.mjs`](./proof.f.mjs) holds the IR of each form, lowered from
  text, the L0 view's, loops, inlined functions, records, `%` and native
  rows among them, and FAST written by hand for the forms that no text
  makes today: a statement of one result, a `return` in an arm, `?:`, a
  loop's body that ends otherwise, and two functions that call each other.
  It holds every refusal too.
- [`proof.mjs`](./proof.mjs) is a host proof. It reads
  [`sample.f.js`](./sample.f.js), 26 FunctionalScript functions of floats,
  booleans and `bigint`s, lowers them from their own text with the
  signatures of [`testlib.f.mjs`](./testlib.f.mjs), and runs them as WASM
  against the functions themselves, on the edges of their parameters'
  types, and so does [`helpers.f.js`](./helpers.f.js), lowered over the
  runtime: functions that call functions it does not export, records, a
  loop that alone reads a `const`, and
  `%`, with a copy of L1's `numberIndex`, which only L1's `get` calls. It
  lowers L1's `toBoolean`, `stringEquals`, `stringLess`, `strictEquals`
  and `stringIndex` from [L1's own text](../../wasm/runtime/l1/module.f.js)
  too, over the runtime, and runs them against L1's own: `toBoolean` on a
  value of every kind, the string comparisons on pairs of strings, a
  surrogate pair among them, and of other values, `strictEquals` on pairs
  of values of every kind, the same value and equal ones among them, and
  `stringIndex` on spellings of indices and on values of other kinds. The
  IR it makes of each is written out there.
