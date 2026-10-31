# List

`List<T>` is the sequence type of FunctionalScript: lazy, immutable, and
accepted in five shapes so that a caller rarely has to convert anything before
passing it in. [`module.f.js`](./module.f.js) holds the combinators, and
[`types.ts`](./types.ts) the shapes.

```js
import { filter, map, take } from './module.f.js'
import { toArray } from './alt/module.f.mjs'

/** The natural numbers, without end. */
const naturals = () => ({ first: 0, tail: map(x => x + 1)(naturals) })

toArray(take(3)(filter(x => x % 2 === 0)(naturals))) // [0, 2, 4]
```

The list above never ends, and the example still finishes with three items:
`filter` and `take` build thunks, and `toArray` walks them only as far as
`take` lets it, which may be one match past the third.

## The five shapes

|Shape                      |Written as                  |Use it for                              |
|---------------------------|----------------------------|----------------------------------------|
|empty                      |`null`                      |the end of a list                       |
|array                      |`[1, 2, 3]`                 |a list that is already in memory        |
|cons cell (`NonEmpty<T>`)  |`{ first: 1, tail: list }`  |building one item at a time             |
|concatenation (`Concat<T>`)|`{ head: list, tail: list }`|joining two lists without copying either|
|thunk (`Thunk<T>`)         |`() => list`                |deferring work until the list is read   |

A thunk is what makes a list lazy, and what lets a list refer to itself, as
`naturals` does. `next` turns any shape into either `null` or a cons cell, and
it unwinds thunks and concatenations in a loop, so a long chain of them does
not grow the call stack.

## What the module offers

Every function is curried, and its configuration comes first, so
`map(f)` is a value that can be stored and composed.

|Group       |Functions                                                                                                   |
|------------|------------------------------------------------------------------------------------------------------------|
|reading     |`next`, `first`, `last`, `find`, `findMap`, `length`                                                        |
|transforming|`map`, `flatMap`, `flat`, `filter`, `filterMap`, `intersperse`, `mergeAdjacent`, `entries`, `zip`, `reverse`|
|slicing     |`take`, `takeWhile`, `drop`, `dropWhile`                                                                    |
|testing     |`some`, `someBy`, `none`, `every`, `isEmpty`, `includes`, `equal`, `sameItems`                              |
|accumulating|`fold`, `reduce`, `scan`, `foldScan`, `stateScan`, `tryFold`                                                |
|machines    |`transduce`, `run`, `fromAccumulator`                                                                    |
|building    |`empty`, `concat`, `fromArrayLike`, `countdown`, `repeat`, `cycle`                                          |

Leaving the list is two modules of its own. [`alt`](./alt/module.f.mjs)'s
`toArray` collects a list into an array with nothing but array spreads, which
is what the FunctionalScript VM can run, so it is the one to import.
[`iterable`](./iterable/module.f.mjs) turns a list into a host iterable, for a
host API that expects one, and has a `toArray` through that iterator; both
need the host's iteration protocol, which the VM does not have yet.

A few of them in use:

```js
import { addition } from '../function/operator/module.f.js'
import { concat, fold, foldScan, reduce, zip } from './module.f.js'
import { toArray } from './alt/module.f.mjs'

toArray(concat([1, 2])([3]))            // [1, 2, 3]
fold(x => acc => acc + x)(0)([1, 2, 3]) // 6
toArray(foldScan(addition)(0)([1, 2, 3])) // [1, 3, 6], every running total
reduce(addition)(null)([])              // null: no items, so the default
toArray(zip([1, 2, 3])(['a', 'b']))     // [[1, 'a'], [2, 'b']]: the shorter one wins
```

**`fold` takes the item first and the accumulator second**, as
`item => acc => next`. That order is the `Fold<I, O>` type of
[`function/operator`](../function/operator/types.ts), shared with
`foldScan`.

**`transduce` drives the shared machine lifecycle.** It yields nonempty output
chunks as `['next', output]`, then exactly one `['done', flush, summary]` event.
Initial output precedes any source read, early completion leaves the source's
suffix unread, and EOF runs the machine's finalizer. Output can be flattened as
`flat(map(([, output]) => output)(transduce(machine)(input)))`; `run(machine)(input)`
returns just the summary without holding the emitted chunks. The source remains
lazy and is read again if these views are read separately.

**`tryFold` is a fold that can give up.** Its `update` answers `null` to abort
the whole fold, and the result is then `null` too. It is the list form of the
`try*`/`Nullable` convention in [`doc/DESIGN.md`](../../../doc/DESIGN.md).
`fromAccumulator` adapts this convenience form to the canonical machine, and
`tryFold` delegates to `run`; domain machines use that shared lifecycle directly.

## Things to know

- **A list is read again every time it is read.** A thunk is not memoized, so
  reading `map(expensive)(list)` twice calls `expensive` twice for each item.
  Call `toArray` once and pass the array on when a result is read more than
  once.
- **`toArray` returns an array unchanged.** Passing an array through it costs
  nothing, so a function can accept any `List` and call `toArray` without
  checking first.
- **Infinite lists are fine** as long as something stops reading them:
  `take`, `takeWhile`, `find`, `first`, `some`. `length`, `reverse`, `fold`
  and `toArray` read to the end, so they never finish on an infinite list.

## Related

- [`string`](../string/module.f.mjs) and [`number`](../number/module.f.mjs)
  are folds over lists of strings and numbers.
- [`function/operator`](../function/operator/module.f.js) holds the binary
  operators (`addition`, `strictEqual`, `logicalNot`) the combinators are
  built from.
