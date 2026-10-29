# Function

Combinators over functions, and the small modules below them that every
fold and comparison in the library is built from. [`module.f.js`](./module.f.js)
holds the combinators, and [`types.ts`](./types.ts) the `Func` and `Fn` types.

```js
import { compose, fixpoint, flip, fn, identity, iterate } from './module.f.js'

compose(x => x + 1)(x => x * 10)(1)       // 20: first + 1, then * 10
fn(x => x + 1).map(x => x * 10).result(1) // 20, written as a chain
iterate(3n)(1)(x => x * 2)                // 8: doubled three times
flip(a => b => a - b)(1)(10)              // 9
fixpoint(x => Math.min(x + 3, 10), (a, b) => a === b)(0) // 10
identity('a')                             // 'a'
```

## The combinators

|Function                 |Does                                                                           |
|-------------------------|-------------------------------------------------------------------------------|
|`compose(g)(f)`          |`x => f(g(x))`. **The first function runs first**, unlike in mathematics.      |
|`fn(f).map(g).result`    |the same composition as a chain, for longer pipelines                          |
|`identity(x)`            |`x`                                                                            |
|`flip(f)(b)(a)`          |`f(a)(b)`: swaps the first two arguments of a curried function                 |
|`iterate(n)(x)(f)`       |`f` applied `n` times, none for `n <= 0n`. `n` is a `bigint`, and the recursion is `O(log n)` deep.|
|`fixpoint(step, same)(x)`|applies `step` until a round answers something `same` as its input             |

**`fixpoint` is a loop, not a recursion,** so a relaxation that takes
thousands of rounds does not overflow the stack. `same` is the caller's,
because a step that rebuilds an array makes a new array even once its contents
stop changing, and `===` would never call it done.

## Below this directory

|Module                              |Holds                                                                                                                                                                                                                                 |
|------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|[`operator`](./operator/module.f.js)|binary operators as curried values: `addition`, `strictEqual`, `logicalNot`, `join`, `concat`, `increment`; the `Fold`, `Reduce`, `Scan` and `StateScan` types; and the conversions between them that [`list`](../list/README.md) uses|
|[`compare`](./compare/module.f.js) |`cmp`, `min`, `max` and a binary search, answering a `Sign` of `-1`, `0` or `1`                                                                                                                                                       |
|[`length`](./length/README.md)      |the `length` of a function, read the same on every engine                                                                                                                                                                             |

`fold`, `reduce` and `scan` in [`list`](../list/README.md) take their operator
in these shapes. `Fold<I, O>` is `item => acc => next`, so the item comes
first:

```js
import { addition } from './operator/module.f.js'
import { fold } from '../list/module.f.mjs'

fold(addition)(0)([1, 2, 3]) // 6
```
