# Array

Helpers for readonly JavaScript arrays. [`module.f.mjs`](./module.f.mjs) holds
the functions, and [`types.ts`](./types.ts) the length-typed array types
(`FixedArray<N, T>`, `BoundedArray`, `OfLength`, `OptionalTailArray`) and
`Occurrences`.

An array is also a [`List`](../list/README.md), so every list combinator takes
one directly. This module is for what a list does not do: index, split and
check length.

```js
import { at, first, last, splitFirst, splitLast, tail } from './module.f.mjs'

at(5)([1])            // null: past the end, not undefined
first([7])            // 7
last([1, 2])          // 2
tail([1, 2, 3])       // [2, 3]
tail([])              // null: an empty array has no tail
splitFirst([1, 2])    // [1, [2]]
splitLast([1, 2])     // [[1], 2]
```

## The functions

|Function                         |Does                                                                    |
|---------------------------------|------------------------------------------------------------------------|
|`at(i)(a)`, `first(a)`, `last(a)`|the item, or `null` when there is none                                  |
|`head(a)`, `tail(a)`             |all but the last, all but the first; `null` for an empty array          |
|`splitFirst(a)`, `splitLast(a)`  |the first or last item and the rest; `null` for an empty array          |
|`isArray(v)`                     |whether `v` is an array                                                 |
|`isFixedArray(n)(a)`             |whether `a` has length `n`, narrowing its type to `FixedArray<n, T>`    |
|`repeat(n)(v)`                   |`n` copies of `v`, typed as `FixedArray<n, T>`                          |
|`includes(a)(v)`                 |whether `a` holds `v`, narrowing `v` to `a`'s item type                 |
|`dedup(a)`                       |the items without repeats, each at its first position                   |
|`occurrences(names)`             |`indexOf` and `lastIndexOf` for every name, from one pass               |
|`assoc(key)(a)`                  |the value of the first `[key, value]` pair whose key is `key`, or `null`|
|`findMap(f)(a)`                  |the first non-`null` answer of `f(item, index)`                         |
|`empty`                          |`[]`, typed as the empty tuple                                          |

**Absence is `null` throughout,** as everywhere in the library
([`nullable`](../nullable/README.md)). `a[i]` answers `undefined` past the end;
`at(i)(a)` answers `null`.

**`isFixedArray` exists because TypeScript cannot narrow by length.** Checking
`a.length === 2` does not tell the type checker that `a` is a pair; the type
guard does, so `const [x, y] = a` is then typed.

**`occurrences` answers in linear time.** Calling `indexOf` for every name of
a list is quadratic; `occurrences` builds both answers once.
