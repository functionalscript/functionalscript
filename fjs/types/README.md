# Types

`fjs/types` is the standard library's data layer: the values every other part
of the repository is built from, and the functions over them. It is the most
imported directory in the tree — the compiler, the effects layer, RTTI, the
media formats and the website all reach for `result`, `list`, `nullable` and
`function` before anything else.

Every `module.f.*` here is plain FunctionalScript. A value is never mutated,
functions are curried with the configuration first and the data last, and
nothing performs I/O. The one exception is
[`result/module.mjs`](./result/module.mjs), a host JavaScript companion whose
`tryCatch` and `asyncTryCatch` run a callback that may throw. Most calls take one argument each, but not all:
`fixpoint(step, same)(start)` takes two in its first call. Most
directories hold a `module.f.mjs` (or `module.f.js`), its `types.ts`, and a
`proof.f.mjs` whose exported `proof` is the module's test suite.

## Conventions

These hold across the directory, and knowing them makes every module below
easier to read.

- **Absence is `null`.** A lookup that finds nothing answers `null`, never
  `undefined` ([`nullable`](./nullable/README.md)). A JavaScript API that
  answers `undefined` is converted at the boundary with `fromUndefined`.
- **Failure is a value.** A step that can fail answers a
  [`Result`](./result/README.md): `['ok', value]` or `['error', e]`. Throwing is
  kept for broken invariants, not for input a caller could get wrong.
- **Sequences are lazy lists.** A [`List`](./list/README.md) may be an array, a
  `null`, a cons cell, a concatenation of two lists or a thunk, and every
  combinator accepts all five. Most combinators that answer a list, such as
  `map` or `filter`, do their work only when something reads the result. A
  few read the whole input when called, so they never return on an infinite
  list: those that answer a single value, such as `fold` and `length`, and
  `reverse`, which answers a list but has to reach the end first.
- **Functions take their configuration first.** `map(f)(list)`,
  `at(key)(object)`, `okThen(step)(result)`: the argument that varies least
  comes first, so a partially applied function is a reusable value.
- **Order is deterministic.** Collections that a `Map` or an object would keep
  in insertion order ([`ordered_map`](./ordered_map/), [`string_set`](./string_set/),
  [`sorted_set`](./sorted_set/)) keep sorted order instead, so two equal
  collections built differently serialise the same way.

## Where to start

|If you need to…                               |Read                                                            |
|----------------------------------------------|----------------------------------------------------------------|
|return a value or an error                    |[`result`](./result/README.md)                                  |
|handle a value that may be absent             |[`nullable`](./nullable/README.md)                              |
|walk, transform or build a sequence           |[`list`](./list/README.md)                                      |
|compose, flip or iterate functions            |[`function`](./function/README.md)                              |
|read an object's own property safely          |[`object`](./object/README.md)                                  |
|take apart a fixed or non-empty array         |[`array`](./array/README.md)                                    |
|keep a sorted, persistent map or set          |[`btree`](./btree/README.md) and its users                      |
|work with arbitrary-precision integers or bits|[`bigint`](./bigint/README.md), [`bit_vec`](./bit_vec/README.md)|

## The modules

### Core values

|Module                   |What it is                                                                                        |
|-------------------------|--------------------------------------------------------------------------------------------------|
|[`result`](./result/)    |`Result<T, E>`: success or failure as a tagged tuple, with `okThen`, `mapOk` and `okList`.        |
|[`nullable`](./nullable/)|`Nullable<T>` (`T \| null`): `match`, `map`, `fromUndefined`, `unwrap`.                           |
|[`option`](./option/)    |`Option<T>`, a value as a zero- or one-element tuple. Types only.                                 |
|[`list`](./list/)        |`List<T>`, the lazy sequence, and about forty combinators over it.                                |
|[`function`](./function/)|`compose`, `identity`, `flip`, `iterate`, `fixpoint`; `operator`, `compare` and `length` below it.|
|[`array`](./array/)      |Readonly arrays: safe `at`, `first`, `last`, `splitFirst`, `splitLast`, `dedup`, `assoc`.         |
|[`object`](./object/)    |Plain objects: own-property `at`, `fromEntries`, `sort`, `isObject`, `structurallySame`.          |
|[`string`](./string/)    |`join`, `concat`, `repeat`, `cmp`, `splitAt` and `occurrences` over strings and string lists.     |
|[`number`](./number/)    |`sum`, `min`, `max`, `cmp`, `countOnes`, `isByte`; `is_negative_zero` below it.                   |
|[`range`](./range/)      |A closed numeric interval `[a, b]` with `contains` and `one`.                                     |
|[`version`](./version/)  |Dotted version numbers such as `26.1.0`, parsed and compared by their numbers.                    |

### Type-level helpers

|Module                 |What it is                                                                               |
|-----------------------|-----------------------------------------------------------------------------------------|
|[`nominal`](./nominal/)|Branded types that the type checker will neither mix nor order-compare with another.     |
|[`phantom`](./phantom/)|`Phantom<S, T>`, a type parameter with no runtime field, like Rust's `PhantomData`.      |
|[`ts`](./ts/)          |The `Equal` compile-time check, used with `Assert` from [`asserts`](../asserts/types.ts), and a printer that writes TypeScript type text.|

### Persistent collections

|Module                             |What it is                                                                                |
|-----------------------------------|------------------------------------------------------------------------------------------|
|[`btree`](./btree/)                |The persistent 2-3 B-tree that `ordered_map` and `string_set` are built on.               |
|[`ordered_map`](./ordered_map/)    |A string-keyed map, traversed in key order.                                               |
|[`string_set`](./string_set/)      |A set of strings, traversed in order.                                                     |
|[`set`](./set/)                    |A persistent set with `Set`'s equality (objects by identity) and a logarithmic `add`.     |
|[`map`](./map/)                    |`mapSet` and `mapDelete`: copy-on-write updates of a JavaScript `Map`.                    |
|[`sorted_list`](./sorted_list/)    |Merging, intersecting and searching sorted lists.                                         |
|[`sorted_set`](./sorted_set/)      |A set held as a sorted array: `union`, `intersect`, `has`.                                |
|[`range_set`](./range_set/)        |A set of numbers as half-open boundaries, closed under union, intersection and complement.|
|[`range_map`](./range_map/)        |A map from numeric ranges to values, with a merge for overlapping ranges.                 |
|[`bit_set`](./bit_set/)            |The bitmask-as-set algebra, shared by the two below.                                      |
|[`byte_set`](./byte_set/)          |A set of bytes (`0..255`) in one 256-bit `bigint`.                                        |
|[`nibble_set`](./nibble_set/)      |A set of nibbles (`0..15`) in one 16-bit `number`.                                        |
|[`patricia_trie`](./patricia_trie/)|A streaming Patricia trie that builds content-addressed binary trees.                     |
|[`stack_walk`](./stack_walk/)      |A driver for walking deep input on an explicit stack instead of the call stack.           |

### Numbers and bits

|Module                         |What it is                                                                            |
|-------------------------------|--------------------------------------------------------------------------------------|
|[`bigint`](./bigint/)          |`bigint` utilities: `log2`, `bitLength`, `abs`, `sign`, `factorial`, `divUp` and more.|
|[`bigfloat`](./bigfloat/)      |Decimal-to-binary float conversion on `bigint` mantissas and exponents.               |
|[`prime_field`](./prime_field/)|Arithmetic modulo a prime: inverse, power and square root. The base of `crypto/secp`. |
|[`bit_vec`](./bit_vec/)        |Bit vectors as `bigint`s with a stop bit, and their conversions to and from bytes.    |
|[`uint8array`](./uint8array/)  |Conversions between `Uint8Array` and bit vectors. Deprecated in favour of `bit_vec`.  |

## Related

- [`fjs/rtti`](../rtti/README.md) describes these same values at runtime: an
  RTTI schema can check that a parsed value really is a `Result` or a list of
  strings.
- [`fjs/effects`](../effects/README.md) is the layer above: a value that
  performs operations, built from `Result` and `List`.
- [`doc/DESIGN.md`](../../doc/DESIGN.md) holds the principles these
  conventions come from.
