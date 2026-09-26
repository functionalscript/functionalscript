# `Array` built-ins

The member functions an array answers, one file each, reached from `array` in
[`../lambda/method.rs`](../lambda/method.rs). Each is ECMAScript 2025's algorithm
on every input a module can build. Behaviour is pinned by the shared corpus in
[`fjs/nanvm`](../../../../fjs/nanvm/README.md), which runs every case on a
JavaScript engine and on this crate. The completeness table
[`fjs/nanvm/methods`](../../../../fjs/nanvm/methods/module.f.mjs) generates,
checked by `completeness` in `method.rs`, keeps this set equal to what the
compiler admits.

## What is out, by design

The language decides which names exist, one by one, with a reason each
([`fjs/js/prototype/README.md`](../../../../fjs/js/prototype/README.md)). This
crate answers exactly `allowedCalls` ∩ `Array.prototype` and grows no entry for
anything else, so a name the compiler refuses cannot be reached another way:

| names | why |
|---|---|
| `copyWithin`, `fill`, `pop`, `push`, `reverse`, `shift`, `sort`, `splice`, `unshift` | Mutate. The pure forms are `toReversed`, `toSorted`, `toSpliced` and `with`. |
| `entries`, `keys`, `values` | Answer an iterator, a type the language lacks. |
| `forEach` | Answers `undefined`; it exists only for side effects. |
| `toLocaleString` | Reads the host locale. |
| `constructor` | A data property, and it reaches `Function`. |

Several branches of the ECMAScript algorithms have no input here, and the code
does not model them:

- **Holes.** No expression builds a sparse array, and `Array<A>` is dense, so
  every "skip a hole" branch collapses.
- **Mutation during iteration.** Nothing mutates, so the elements a callback
  sees are the ones the call started with, and iterating `Array<A>` directly is
  the specified behaviour.
- **Species and `Symbol.isConcatSpreadable`.** There are no classes or symbols:
  every result is a plain array, and `concat` spreads exactly the arrays.
- **`thisArg`.** Every function is an arrow that never reads `this`, so the
  argument `map`, `filter` and the other iterations take is accepted and has no
  effect, as it has none on a JavaScript arrow. Refusing it would reject a
  harmless convention for nothing
  ([DESIGN.md §12](../../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
- **Cycles.** An immutable value cannot contain itself, so `join` and `flat`
  need no cycle detection.

`Array.from`, `Array.of` and `Array.isArray` are namespace functions, not
member functions.

## When passing an argument matters

The EDAG keeps a call's argument count, so `f(x)` and `f(x, undefined)` are two
calls, and three built-ins answer them differently, as JavaScript does. They read
the argument through `present` in `method.rs` rather than `argument`:

- `lastIndexOf(x)` searches from the end; `lastIndexOf(x, undefined)` from `0`.
- `reduce(f)` and `reduceRight(f)` throw on an empty array;
  `reduce(f, undefined)` answers `undefined`.
- `toSpliced(s)` removes to the end; `toSpliced(s, undefined)` removes nothing.

## The one implementation-defined result

ECMAScript leaves the order of `toSorted` with an inconsistent comparator
(`() => 1`) to the engine, and with it which of two elements a comparator is
handed first. That is observable here only through a throw. This crate answers
what its stable merge sort answers, deterministic on this VM as V8's answer is
on V8, and the corpus pins only comparators whose answer does not depend on the
order. Whether the language should do more is
[`fjs/js/prototype/todo/to-sorted-inconsistent-comparator.md`](../../../../fjs/js/prototype/todo/to-sorted-inconsistent-comparator.md).

## Shared pieces

- [`relative.rs`](relative.rs): a relative position, `ToIntegerOrInfinity`
  counted from the end, and its clamp into the array.
- [`callback.rs`](callback.rs): the callback checked before any element is
  visited, `visit` with the element, index and array, `position` for the
  searches, `fold` for the reductions.
- [`create.rs`](create.rs): a result past `2³² − 1` elements is the `RangeError`
  JavaScript throws, never wrapped.

`flat` and `join` recurse once per nesting level:
[`array-deep-nesting`](../../../todo/array-deep-nesting.md).
