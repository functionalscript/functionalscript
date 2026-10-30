# Common

Algebraic structures shared across the library. Today that is one module,
[`monoid`](./monoid/module.f.mjs).

## Monoid

A `Monoid<T>` is an identity, an associative operation and a weight, how
heavy a value is for the balanced fold: a length where the operation copies
its operands, a magnitude where it rounds, zero where its cost does not depend
on the operands. The weight is read from each value, a merged one included.

```js
const add = { identity: 0, operation: a => b => a + b, weight: Math.abs }
const concat = { identity: '', operation: a => b => a + b, weight: s => s.length }
```

| Function | Does |
|---|---|
| `repeat({ identity, operation })(n)(a)` | applies the operation `n` times, by squaring, in `log2(n)` steps; `n` is a non-negative `bigint`; reads no weight |
| `fold(monoid)(list)` | combines a list as a balanced tree, balanced by the monoid's weight, keeping order |
| `foldAbsorbing({ monoid, absorbing })(list)` | `fold` that stops at the absorbing element |
| `step` and `runs` | the balanced fold's stack, for a structure that keeps it |
| `move(monoid)(folding)(walk)` | one move of the fold, the rule itself; `step` and the fold at the end loop over it, and the module's demo draws every move as a merge tree |

```js
repeat(add)(10n)(3)          // 30
repeat(concat)(3n)('ab')     // 'ababab'
fold(add)([1, 2, 3, 4])      // 10
fold(concat)([])             // ''

const multiply = {
    monoid: { identity: 1, operation: a => b => a * b, weight: Math.abs },
    absorbing: 0,
}
foldAbsorbing(multiply)([2, 0, 4])  // 0, and 4 is never read
```

The balanced fold matters for operations whose cost grows with their operands,
such as joining strings or bit vectors: combining equal-sized halves keeps the
total cost near `n log n` instead of the `n²` a left fold can cost.
`foldAbsorbing` is the one to use on an unbounded lazy list, where `fold` would
never finish. [`fjs/types/set`](../types/set/module.f.mjs) keeps the run stack
itself through `step`.
