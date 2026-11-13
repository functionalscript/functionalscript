# From normalized FAST

The lowering of the second, third and fourth slices
([todo/slices.md](../todo/slices.md)): a FunctionalScript module's
normalized FAST, as [`edag/to_fast`](../../edag/to_fast/README.md) makes it,
to a module of the [IR](../README.md), for the part of the language that
the first slice admits, for values of unknown kind, which the third reads
through the L0 view, and for the loops that the fourth adds. It reads FAST
before
[preparation](../../js/ast/prepare/README.md) adds mutable slots, as
definition.md's
[open question 2](../../../doc/sasha-gil/ir/definition.md#open-questions)
recommends, and as the owner chose to assume on 2026-11-13.

```js
import { unwrap } from '../../types/result/module.f.js'
import { check } from '../check/module.f.mjs'
import { f64, signature } from '../module.f.mjs'
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
[L0](../l0/module.f.mjs) seals; the checker then finds the range of every
result and refuses one wider than a word. A `number` is never an integer
range in these slices.

The table also chooses what to lower. The lowering reads a module's
functions, not its evaluation: of everything else that the module defines,
it reads only what a function that it lowers reads, so L1, which exports
far more, gives the three functions that the slices name so far:
`toBoolean`, `stringEquals` and `stringLess`.

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
| a call of a function that the function defines | its body, inlined where the call stands |
| a `number`, a `bigint`, a `boolean` | a `lit` of `f64c`, a `lit` of its own range, a variant of `bool` |
| `+`, `-`, `*`, `/`, `<`, `<=` | `add`, `sub`, `mul`, `div`, `lt`, `le` |
| `a > b`, `a >= b` | `lt(b, a)`, `le(b, a)`, with `a` bound to a local first where it does something |
| `a === b`, `a !== b` | `eq`, `ne` of numbers; of two booleans, `if_(a, b, not(b))` and `if_(a, not(b), b)` |
| `-x` | `neg(x)` of a float, `sub(0, x)` of an integer |
| `!x`, `Number(x)` | `not(x)` of a `bool`; `float(x)` of an integer, and `x` of a float |
| `Math.sqrt(x)`, `Math.abs(x)` | `sqrt(x)`, `abs(x)` |
| a call of an exported function, or of the function itself | a `call` of `self` |

## Loops, and functions inside functions

Normalized FAST makes a function of each loop of the source and calls it
once, and a call of a function itself in its tail is a loop already. The
lowering inlines a function inside a function at each call: its parameters
stand for the arguments, a local or a literal as itself and anything else
bound to a local first, in their order; its captures stand for what they
read where the call stands; and the `return` that ends its body is its
value. [definition.md's rule 5](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)
lifts such a function to the module instead. Inlining needs no closure
conversion and no new function, and is exact, since the function reads
nothing but its parameters and its captures, which stand for the same
values where it is called; it gives one copy of the body for each call.

A loop's parameters are locals of the types of their first values, a float
widened to `f64`, since a later round may give any float. An integer range
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
array, which waits for the slice of builders, so such a loop is refused.

## The L0 view

The caller names the specifier by which the module imports the
[L0 view](../../wasm/runtime/l0/module.f.js), since the lowering resolves
no path, and the module then imports
[the interfaces of L0](../l0/module.f.mjs). Every function of the view
that it reads takes a value of `any` first.

| The L0 view | The IR |
| --- | --- |
| `kind(v)` | `float(Any.kind(v))` |
| `UNDEFINED`, `NULL`, …, `FUNCTION` | the tag, a `lit` of `f64c` |
| `asBoolean(v)`, `asNumber(v)`, `asString(v)` | a `cast` of `v` to `boolean`, `number` or `string`, whose arm calls `Any.to_bool` or `Any.to_f64`, or is `v.string`, and a trap for the other kinds; `v` itself where it holds no other kind |
| `length(v)` | `float` of a `match` of `v`: an arm for each module of L0 that has a `length`, and a trap for the kinds that none takes; a call where one module takes every kind that `v` holds, `String.length(v.string)` |
| `unit(s, i)` | `float` of a `cast` of `s` to `string`, whose arm reads the integer of `u(31)` that `i` holds, with `exact`, and calls `String.unit`; it traps (`'inexact'`) where `i` holds none |

JavaScript reads a tag and a length as numbers, so each is a float, and
the operators on them are a float's: L1's `kind(v) === NUMBER` is
`eq(float(Any.kind(v)), 3.0)`. An arm names the operand at its kinds after
the operand and the kind, `v.number`, or after the module of L0, as
`length`'s arms do: `v.string`. Where the operand is no local, the
function's name stands for it. JavaScript reads both arguments of `unit`
before it casts the string, so an index that does something is bound to a
local first, after the string where that does something too.

A cast narrows the rest of its block, as
[definition.md's rule 4](../../../doc/sasha-gil/ir/definition.md#from-normalized-fast-to-the-ir)
says. Where the first thing that a definition does is a cast of a local
that holds other kinds too, `asString(a)` say, a `cast` of that local wraps
the definition and the rest of the block, which read the local as
`a.string`: a cast of it there is the value itself, and its `length` is
String's. L1's `const n = length(asString(a))` narrows `a` so for the rest
of `stringEquals`. A cast after something else that the definition does
narrows nothing, since that would move the cast's trap before it.

## Operators

Where JavaScript has one operator for two types, the operand's type picks
the IR's: the lowering asks the [checker](../check/module.f.mjs) for it,
with `typeOf`, in the scope where the term stands. FAST has no `&&`, `||`
or `??`: they reach it as conditionals.

`a > b` is `lt(b, a)` and `a >= b` is `le(b, a)`. Where `a` does
something, it is bound to a local first, so that it is still done before
`b`: either may trap, as a cast does, and a loop may never end.

## What it refuses

Everything else, with the function's name and the reason
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)):
an import other than the L0 view, among them a JSON module, a function of
the view other than these six, a module constant that a lowered function
reads, a function that is not exported, a function as a value, a function
inside a function that names itself or whose call gives another number of
arguments, a loop of more than one variable, a loop parameter of an integer
range, a `break` that does not end its loop's body, a `return` inside a
loop or before the end of a function inside a function, `throw`, a `lazy`
definition, a string, `null`, `undefined`, a rest parameter, a spread
argument, a statement of no result or of several, and every operator not
in the table, such as `%`, `**` and the bitwise ones. The
[checker](../check/module.f.mjs)
then refuses what the IR does not admit, such as a condition that is not a
`bool`, integers mixed with floats, or a division of integers.

## Proofs

- [`proof.f.mjs`](./proof.f.mjs) holds the IR of each form, lowered from
  text, the L0 view's, loops and inlined functions among them, and FAST
  written by hand for the forms that no text makes today: a statement of
  one result, a `return` in an arm, `?:`, and a loop's body that ends
  otherwise. It holds every refusal too.
- [`proof.mjs`](./proof.mjs) is a host proof. It reads
  [`sample.f.js`](./sample.f.js), 26 FunctionalScript functions of floats,
  booleans and `bigint`s, lowers them from their own text with the
  signatures of [`testlib.f.mjs`](./testlib.f.mjs), and runs them as WASM
  against the functions themselves, on the edges of their parameters'
  types. It lowers L1's `toBoolean`, `stringEquals` and `stringLess` from
  [L1's own text](../../wasm/runtime/l1/module.f.js) too, over the L0 view,
  and runs them against L1's own: `toBoolean` on a value of every kind, and
  the string comparisons on pairs of strings, a surrogate pair among them,
  and of other values. The IR it makes of each is written out there.
