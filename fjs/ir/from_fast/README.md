# From normalized FAST

The lowering of the second slice ([todo/slices.md](../todo/slices.md)): a
FunctionalScript module's normalized FAST, as
[`edag/to_fast`](../../edag/to_fast/README.md) makes it, to a module of the
[IR](../README.md), for the part of the language that the first slice
admits. It reads FAST before [preparation](../../js/ast/prepare/README.md)
adds mutable slots, as definition.md's
[open question 2](../../../doc/sasha-gil/ir/definition.md#open-questions)
recommends, and as the owner chose to assume on 2026-11-13.

```js
import { unwrap } from '../../types/result/module.f.js'
import { check } from '../check/module.f.mjs'
import { f64, signature } from '../module.f.mjs'
import { lower } from './module.f.mjs'
import { fastOf } from './testlib.f.mjs'

const fast = unwrap(fastOf('export const max = (a, b) => a < b ? b : a'))
const ir = unwrap(lower({ max: signature([['a', f64], ['b', f64]], f64) })(fast))
const checked = unwrap(check(ir))
```

## Types come from a table

FAST has no types, so the lowering takes a signature for each exported
function, by its name: the names and types of its parameters and the type
of its result, as a TypeScript signature has them. A `number` is an `f64`,
a `boolean` a `bool`, and a `bigint` the integer range that its signature
gives it; the checker then finds the range of every result and refuses one
wider than a word. A `number` is never an integer range in this slice.

## What it lowers

| Normalized FAST | The IR |
| --- | --- |
| an exported function, or a module definition of a function that is exported | a function, named by its export |
| `define`, `required`; a `block` or an `if` statement of one result | a `let`, of a local named `#0`, `#1`, … by how many `let`s enclose it |
| `['if', c, a, b]`, `?:` | `if_(c, a, b)`: a `match` of a `bool` |
| `['block', b]` | the block's statements as `let`s around its exit's value |
| `return` | the body's value in the tail of a function, and `return_` elsewhere |
| a `number`, a `bigint`, a `boolean` | a `lit` of `f64c`, a `lit` of its own range, a variant of `bool` |
| `+`, `-`, `*`, `/`, `<`, `<=` | `add`, `sub`, `mul`, `div`, `lt`, `le` |
| `a > b`, `a >= b` | `lt(b, a)`, `le(b, a)` |
| `a === b`, `a !== b` | `eq`, `ne` of numbers; of two booleans, `if_(a, b, not(b))` and `if_(a, not(b), b)` |
| `-x` | `neg(x)` of a float, `sub(0, x)` of an integer |
| `!x`, `Number(x)` | `not(x)` of a `bool`; `float(x)` of an integer, and `x` of a float |
| `Math.sqrt(x)`, `Math.abs(x)` | `sqrt(x)`, `abs(x)` |
| a call of an exported function, or of the function itself | a `call` of `self` |

Where JavaScript has one operator for two types, the operand's type picks
the IR's: the lowering asks the [checker](../check/module.f.mjs) for it,
with `typeOf`, in the scope where the term stands. FAST has no `&&`, `||`
or `??`: they reach it as conditionals.

Swapping the operands of `>` and `>=` is exact while no term can fail, since
only a diverging operand could tell the order, and then the whole diverges.
The slice that adds failure binds them in their order first.

## What it refuses

Everything else, with the function's name and the reason
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)):
an import, a module constant, a function that is not exported, a function
inside a function or as a value, a loop, `throw`, a `lazy` definition, a
string, `null`, `undefined`, a rest parameter, a spread argument, a
statement of no result or of several, and every operator not in the table,
such as `%`, `**` and the bitwise ones. The [checker](../check/module.f.mjs)
then refuses what the IR does not admit, such as a condition that is not a
`bool`, integers mixed with floats, or a division of integers.

## Proofs

- [`proof.f.mjs`](./proof.f.mjs) holds the IR of each form, lowered from
  text, and FAST written by hand for the forms that no text makes today: a
  statement of one result, a `return` in an arm and `?:`. It holds every
  refusal too.
- [`proof.mjs`](./proof.mjs) is a host proof. It reads
  [`sample.f.js`](./sample.f.js), 26 FunctionalScript functions of floats,
  booleans and `bigint`s, lowers them from their own text with the
  signatures of [`testlib.f.mjs`](./testlib.f.mjs), and runs them as WASM
  against the functions themselves, on the edges of their parameters'
  types. The IR it makes of them is written out there.
