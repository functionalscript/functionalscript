# Common

Algebraic structures shared across the library. Today that is one module,
[`monoid`](./monoid/module.f.mjs).

## Monoid

A `Monoid<T>` is an identity and an associative operation:

```js
const add = { identity: 0, operation: a => b => a + b }
const concat = { identity: '', operation: a => b => a + b }
```

| Function | Does |
|---|---|
| `repeat(monoid)(n)(a)` | applies the operation `n` times, by squaring, in `log2(n)` steps; `n` is a non-negative `bigint` |
| `fold(monoid)(list)` | combines a list as a balanced tree, keeping order |
| `foldBy(weight)(monoid)(list)` | `fold` balanced by the weight of each value, so a long value among short ones is copied once |
| `foldAbsorbing({ monoid, absorbing })(list)` | `fold` that stops at the absorbing element |
| `foldAbsorbingBy(weight)({ monoid, absorbing })(list)` | `foldBy` that stops at the absorbing element |
| `step`, `stepBy` and `runs` | the balanced fold's stack, for a structure that keeps it |

```js
repeat(add)(10n)(3)          // 30
repeat(concat)(3n)('ab')     // 'ababab'
fold(add)([1, 2, 3, 4])      // 10
fold(concat)([])             // ''

const multiply = {
    monoid: { identity: 1, operation: a => b => a * b },
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
