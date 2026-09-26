## `Array` member functions

**Priority:** P2
**Status:** open

### Problem

The compiler admits a call of every name in `allowedCalls`
([`fjs/js/prototype`](../../fjs/js/prototype/module.f.mjs)), and on an array
the VM answers two of them, `at` and `toString`
([`vm/lambda/method.rs`](../src/vm/lambda/method.rs)). Every other `Array`
name compiles and then throws the `TypeError` for calling `undefined`, so
`[1, 2].map(f)` is a module that means one thing on a JavaScript engine and
another on NaNVM — the divergence the two lists in `fjs/js/prototype` exist to
prevent ([member-functions](./member-functions.md), Problem).

These are the names the compiler's own source uses most — `map`, `filter`,
`flatMap`, `reduce`, `join`, `includes`, `slice`, `concat` — so they stand
between the MVP pipeline and the self-hosting milestone
([mvp-roadmap](./mvp-roadmap.md)).

This file is the specification of the `Array` half of
[member-functions](./member-functions.md): what each built-in computes on
this VM, what it deliberately does not, how it is tested, and the order it
lands in. The general machinery — the call step, the per-type table, the
own-property-first lookup — is that file's and is already landed; nothing here
changes it.

### What is out, by design

The language decides which `Array` names exist, not this VM, and it has
decided them name by name with a reason each
([`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md)). The VM
answers exactly `allowedCalls` ∩ `Array.prototype` and **must not grow an
entry for anything else**, so that a name refused by the compiler is also
unanswerable by the VM, and hand-built EDAG cannot reach it either. The
completeness test below pins both directions.

Refused as a call, and so never an entry here:

| names | why |
|---|---|
| `copyWithin`, `fill`, `pop`, `push`, `reverse`, `shift`, `sort`, `splice`, `unshift` | Mutate. The pure forms are `toReversed`, `toSorted`, `toSpliced` and `with`, and those are the ones answered. |
| `entries`, `keys`, `values` | Answer an iterator, a type the language lacks. |
| `forEach` | Answers `undefined`; it exists only for side effects. |
| `toLocaleString` | Reads the host locale. |
| `constructor` | A data property, and it reaches `Function`. |

`length` is on neither list: an array owns it, so `a.length()` calls a number
and throws, which the own-property lookup already does.

Beyond the names, several things JavaScript's algorithms account for have no
inhabitant in this language. They are not special cases the VM refuses. They are
branches of the specification that cannot run, and the Rust code must not model
them:

- **Holes.** No FunctionalScript expression builds a sparse array
  ([`spec/README.md`](../../spec/README.md), Arrays: "an array has no holes";
  [new-array-out-of-subset](../../todo/new-array-out-of-subset.md)), and
  `Array<A>` is dense by construction. Every `HasProperty(O, Pk)` in the
  ECMAScript algorithms is therefore true for `k < len`, and the "skip a hole"
  branches of `map`, `filter`, `every`, `some`, `reduce`, `flat`, `indexOf`
  and the rest collapse. (`includes` and `find*` never skipped holes anyway.)
- **Mutation during iteration.** The algorithms read `len` once and then
  re-read each element, because a callback may mutate the array. Nothing here
  mutates, so the elements a callback sees are the ones the call started with.
  Iterating the `Array<A>` directly is exactly the specified behaviour, not an
  approximation of it.
- **Species and subclassing.** `ArraySpeciesCreate` consults
  `constructor[Symbol.species]`. There are no classes and no symbols, and
  `constructor` is refused, so every result is a plain array.
- **`Symbol.isConcatSpreadable`.** A module cannot spell a symbol, so `concat`
  spreads exactly the values that are arrays (`IsArray`), and appends
  everything else whole, an object included.
- **`thisArg`.** `map`, `filter`, `every`, `some`, `find`, `findIndex`,
  `findLast`, `findLastIndex` and `flatMap` take a second argument that becomes
  the callback's `this`. Every function here is an arrow and none reads `this`
  ([`README.md`](../../fjs/js/prototype/README.md), `apply`/`bind`/`call`), and
  a built-in is never a value a module can pass as the callback (a detached
  built-in is refused as a read). So the argument is **accepted and has no
  effect**, which is exactly what JavaScript does with an arrow's `this`.
  Refusing it would reject a harmless JavaScript convention for no guarantee
  gained ([DESIGN.md §12](../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions)).
- **Cycles.** An immutable value cannot contain itself, so `join` and `flat`
  recurse without the cycle detection engines carry for `join`.

`Array.from`, `Array.of` and `Array.isArray` are namespace functions
([`spec/todo/2360-built-in.md`](../../spec/todo/2360-built-in.md)), not member
functions. They are not reached through a call step and are out of scope here.

Nothing is added that JavaScript does not have: no convenience members, no
extra parameters, no alternative argument conventions. If an allowed name
behaves differently here from the ECMAScript 2025 algorithm on any input a
module can build, that is a bug, except in the cases that are listed explicitly
under Implementation-defined results.

### Proposal

#### Where each built-in lives

As `at` does: one file per built-in under the receiver's type,
`vm/array/{snake_name}.rs` (`map.rs`, `find_last_index.rs`, `to_sorted.rs`),
an inherent method on `Array<A>` with its own unit tests, and one line in
`array` in `vm/lambda/method.rs` mapping the key to a `Method<A>` adapter that
reads the arguments and calls it. The adapter is where argument
presence and conversion live, and the `Array<A>` method takes typed values,
the same division `array_at` / `Array::at` has.

Shared pieces, written once and reused, never restated per built-in:

- **Argument access.** `argument(args, i)` (already in `method.rs`) reads a
  parameter the call left out as `undefined`. Add `present(args, i) ->
  Option<Any<A>>` for the three algorithms whose result depends on whether an
  argument was *passed*, not on its value:
  - `lastIndexOf(x)` searches from the end, while `lastIndexOf(x, undefined)`
    searches from index `0`, since `ToIntegerOrInfinity(undefined)` is `0`.
  - `reduce(f)` / `reduceRight(f)` throw on an empty array, while
    `reduce(f, undefined)` answers `undefined`.
  - `toSpliced(s)` removes to the end, `toSpliced(s, undefined)` removes
    nothing, and `toSpliced()` removes nothing.

  The EDAG preserves the argument count, since `f(a, undefined)` is a
  two-element argument array. So this is observable, and conflating the two
  would be a plausible wrong answer.
- **Relative index.** `at`, `slice`, `includes`, `indexOf`, `lastIndexOf`,
  `toSpliced` and `with` all do `ToIntegerOrInfinity`, then resolve a
  negative index relative to `len` and clamp it, in one of two ways:
  - **clamped into `[0, len]`**: `slice`, `includes`, `indexOf`, `toSpliced`
  - **left unclamped for a range check**: `at`, `with`, and `lastIndexOf`,
    which clamps to `len - 1`

  One helper answers the relative position as an `f64` (the arithmetic `at`
  already does inline), and `at` is refactored onto it in the PR that adds it.
  A bigint argument throws the `TypeError` `ToNumber` throws, as it does for
  `at` today.
- **The callback.** `Function::try_from(argument(args, 0))?`, **before any
  element is visited**, so `[].map(1)` throws as JavaScript's `IsCallable`
  check does, even on an empty array. Each call is
  `Function::call` with an argument array built fresh for that call:
  `[element, index, array]` for the iteration methods,
  `[accumulator, element, index, array]` for `reduce` and `reduceRight`, and
  `[a, b]` for a comparator. The index is a `Number`. The array is **the
  receiver itself**, the same value, so `a === arr` holds in the callback.
  A throw from the callback stops the built-in and is its result, unchanged.
- **Truthiness.** `Any::to_boolean`, `ToBoolean`, for every predicate result.
- **Equality.** `indexOf` and `lastIndexOf` use `IsStrictlyEqual`, which is
  `Any`'s `PartialEq` (`NaN` never found, `0` finds `-0`). `includes` uses
  `SameValueZero`, which is strict equality except that `NaN` equals `NaN`.
  Add it once, next to `Any`'s `PartialEq`, as a named function rather than a
  second `PartialEq`.
- **Element to string.** `join` uses the same element conversion as
  `arr_to_string` in `vm/primitive_coercion.rs` (`undefined` and `null` become
  `""`, everything else goes through `ToString`). `Array.prototype.toString`
  *is* `join` with the default separator, so `arr_to_string` becomes a call to
  `Array::join`, one implementation for both. The function-element case is
  [member-functions](./member-functions.md)' `Function` `toString` item.
  `join` and `toSorted` go through the one conversion that item fixes, and
  neither adds a local rule.
- **Result length.** `concat`, `toSpliced`, `flat` and `flatMap` build an
  array whose length is not bounded by the receiver's — `toSpliced`'s is
  `len − deleteCount + items.length`. `Array<A>` is indexed by `u32`,
  and JavaScript's own limit is the same `2³² − 1`. A result past it
  **throws a `RangeError`**. It never wraps and never truncates
  ([DESIGN.md §10](../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

#### The built-ins

Grouped by the PR that lands them (see Tasks). Each row is the whole
contract. The ECMAScript section is the reference, minus the branches listed
under What is out, by design. **Present** means the argument was passed, as
opposed to omitted.

**Search.** No callback, and a primitive answer.

| name | contract |
|---|---|
| `includes(x, from?)` | `true` if some element at or after `from` (relative, clamped into `[0, len]`, default `0`) is `SameValueZero` to `x`. `[NaN].includes(NaN)` is `true`. |
| `indexOf(x, from?)` | The first index at or after `from` whose element is `===` `x`, else `-1`. `[NaN].indexOf(NaN)` is `-1`. |
| `lastIndexOf(x, from?)` | The last index at or before `from`, else `-1`. `from` defaults to `len - 1` **only when absent**. A present `undefined` is `0`. A negative `from` resolves against `len`, and below `0` answers `-1`. |

**Copies.** No callback, and a new array.

| name | contract |
|---|---|
| `slice(start?, end?)` | Elements `[start, end)`, both relative and clamped into `[0, len]`. `end` defaults to `len` when absent or `undefined`. An empty range is `[]`. |
| `concat(...items)` | The receiver's elements, then each item in order, spread if it is an array and appended whole otherwise. Spreading is one level: `[1].concat([[2]])` is `[1, [2]]`. |
| `toReversed()` | The elements in reverse order. |
| `with(i, v)` | A copy with element `i` (relative, unclamped) replaced by `v`. An `i` outside `[0, len)` after resolution is a `RangeError`, checked before the copy. |
| `toSpliced(start?, skip?, ...items)` | `start` is relative and clamped into `[0, len]`. `skip` is `0` when `start` is absent, `len - start` when `skip` is absent, and otherwise `ToIntegerOrInfinity(skip)` clamped into `[0, len - start]`. The result is the prefix, then `items`, then the suffix. |

**`join`.**

| name | contract |
|---|---|
| `join(sep?)` | The elements converted as above and joined by `sep`, which is `","` when absent or `undefined` and `ToString(sep)` otherwise, so `null` joins with `"null"`. A nested array converts through its own `join(",")`, so `[1, [2, [3]]].join(";")` is `"1;2,3"`. |

**Iteration.** A callback of `(element, index, array)`, visited in index order
(`findLast` and `findLastIndex` in reverse). The first four stop at the first
decisive answer.

| name | contract |
|---|---|
| `every(f)` | `false` at the first falsy result, else `true`. `[].every(f)` is `true`. |
| `some(f)` | `true` at the first truthy result, else `false`. |
| `find(f)` / `findLast(f)` | The first (last) element whose result is truthy, else `undefined`. |
| `findIndex(f)` / `findLastIndex(f)` | Its index, else `-1`. |
| `map(f)` | Every result, in order, same length. |
| `filter(f)` | The elements whose result is truthy, in order. |

Stopping early is observable only through a throw, since nothing else has an
effect. The corpus pins it with a callback that throws on an element it must
not reach.

**Folds.**

| name | contract |
|---|---|
| `reduce(f, init?)` | The accumulator starts at `init` when **present**. Otherwise it is element `0` and the visit starts at `1`, and an empty array is a `TypeError`. `f(acc, element, index, array)` is called left to right. |
| `reduceRight(f, init?)` | The same, from the end: `[1, 2, 3].reduceRight((a, b) => a + "-" + b)` is `"3-2-1"`. |

**Flattening.**

| name | contract |
|---|---|
| `flat(depth?)` | `depth` is `1` when absent or `undefined`, and `ToIntegerOrInfinity` otherwise. `Infinity` flattens fully, and `depth ≤ 0` copies. An element that is an array at remaining depth `> 0` is spliced in, recursively. A bigint depth throws. |
| `flatMap(f)` | `map(f)` then one level of `flat`: a result that is an array is spliced in, one level only, and any other result is appended. |

**`toSorted`.**

| name | contract |
|---|---|
| `toSorted(cmp?)` | `cmp` must be `undefined` (absent or passed) or a function, and anything else, `null` included, is a `TypeError` before any element is read. The sort is **stable**. `undefined` elements go last, in their original order, and are never handed to `cmp`. With no `cmp`, elements compare by their `ToString` as UTF-16 code units (`String<A>`'s `Ord`), so `[10, 9, 1]` sorts `[1, 10, 9]`. With `cmp`, `a` precedes `b` when `ToNumber(cmp(a, b)) < 0`: `NaN` and `undefined` count as `0`, and a bigint result throws, as `ToNumber` does. |

Two implementation notes on `toSorted`, both chosen for simplicity:

- **The default comparison converts each element once**, then sorts the
  (key, element) pairs by key. Conversion is pure, so converting once per
  element is indistinguishable from converting per comparison. The one
  exception is *which* throw a throwing conversion surfaces, and that falls
  under the next section. Only elements that are not `undefined` are
  sorted, so the count that matters is theirs: with fewer than two, nothing
  is compared, so nothing is converted, and a lone such element whose
  conversion throws is copied, as in JavaScript, `[x, undefined]` included.
  With two or more, every one of them is compared, and so converted, in
  JavaScript too.
- **The algorithm is a plain stable merge sort** over a `Vec`, whose
  comparator is fallible, and whose first `Err` aborts the sort and is the
  result. Rust's `slice::sort_by` cannot propagate an `Err` out of a
  comparison, so a hand-written merge is the simpler honest choice over
  smuggling a `Result` out of the closure.

#### Implementation-defined results

ECMAScript leaves exactly one thing about these built-ins to the engine. The
`toSorted` order is implementation-defined when `cmp` is not a *consistent
comparator* (for example `() => 1`, or `(a, b) => Math.random() - 0.5`), and so
is the sequence of comparisons it makes. In a pure language the comparison
sequence is observable only through which throw surfaces, when `cmp` or a
default conversion throws for more than one pair.

`fjs/js/prototype` says every allowed name is "specified exactly, and the same
on every engine". For `toSorted` that is true only for consistent comparators
that do not throw. This VM does not try to detect an inconsistent comparator,
because detection needs every pair compared. It answers whatever its merge
sort answers, which is deterministic on this VM, as V8's answer is on V8.
The corpus pins only consistent, non-throwing comparators, and one throwing
case asserts *that* it throws, not what. The `toSorted` row in
[`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md) should say so
(see Tasks). Whether the language should go further, and refuse `toSorted`
with a comparator or specify one algorithm for every engine, is a
language-design question outside this file.

#### Tests: one corpus, both sides

The `at` precedent tests end to end through a harness fixture whose expected
JSON was copied by hand from Node. That does not scale to this many built-ins
with this many edge cases, and a hand-copied expectation is not an oracle. The
operators already have the right design
([`fjs/nanvm/README.md`](../../fjs/nanvm/README.md)). A case is data, it lowers
to an EDAG expression, [amnesia](../../fjs/edag/amnesia/README.md) evaluates it
on the host engine (whose `Array.prototype` is the reference), and the Rust
printer emits it into the generated corpus test. Method calls join that corpus,
which needs three additions to it:

1. **A method-call group.** `{ method: 'map', cases: [...] }`, each case's
   `args` being `[receiver, ...arguments]`. It lowers to the chain node a
   compiled `receiver.map(...arguments)` is,
   `['.', receiver, 'map', ['|()', ['[]', arguments]]]`
   ([`fjs/edag/README.md`](../../fjs/edag/README.md), Chains), which amnesia's
   `callProperty` already calls on the host array. `method` is typed
   `(typeof allowedCalls)[number]`, imported from `fjs/js/prototype`, so a
   misspelt or refused name fails `tsc`.
2. **Callbacks.** Today a corpus function is only `() => undefined`. Add a
   small named vocabulary, each entry one EDAG `=>` built by a constructor in
   `fjs/nanvm/module.f.mjs`, with its JavaScript spelling in its JSDoc, and
   printed through the shared closure printer in
   [`fjs/edag/rust`](../../fjs/edag/rust/module.f.mjs) (which prints any
   `=>` already, exported for reuse if it is not). A proposed starting set:
   - `args`, `(...a) => a`: answers exactly what the callback was given, so a
     `map(args)` case pins the element, the index, the array's contents, and
     the argument count, `reduce`'s four included. Not the array's identity:
     the corpus compares results structurally, so a fresh copy would pass,
     and `ref` is gone once lowered. Identity is pinned where it is visible,
     in the Rust unit test of the visit, since `==` on an array is `===`.
   - `prop`, `(...a) => a[0].x`: truthy on `{ x: 1 }`, falsy on `{}` or `0`,
     and throws on `null`. That is the short-circuit probe:
     `[{ x: 1 }, null].some(prop)` answers `true` only if `null` was never
     visited.
   - `add`, `(...a) => a[0] + a[1]`: `reduce` and `reduceRight`, with strings,
     so the order shows.
   - `pair`, `(...a) => [a[0], [a[0]]]`: `flatMap` splices one level only.
   - `ascending`, `(...a) => a[0] - a[1]`, and `descending`: comparators.
   - `double`, `(...a) => a[0] * 2`: `map` without ceremony.
3. **Structural expectations.** Both sides compare a result with `Object.is`
   today (`is` in [`fjs/nanvm/proof.f.mjs`](../../fjs/nanvm/proof.f.mjs),
   `same` in `nanvm-lib/tests/test/harness.rs`). That is identity for an
   array, and every result here is a fresh array. Both become structural for
   arrays and objects, keeping `Object.is` at the leaves (so `NaN` matches
   `NaN` and `-0` does not match `0`) and identity for functions. Where a case
   is about identity, it says so with `ref` and `===` as the operator cases
   already do.

The harness keeps one end-to-end fixture per landing PR, as `at.mjs` does.
It is proof that the compiled chain reaches the entry, not the place edge
cases live.

#### Completeness, both directions

[member-functions](./member-functions.md)' open "generated completeness test
over `allowedCalls`" is built here, for every type, since the `Array` rows
are only a filter of it. `npm run gen` writes a generated Rust table of every
(type, name) pair from the seven prototype lists, and a unit test beside
`method` asserts:

- every pair in `allowedCalls` × that type's prototype list **has** an entry,
  except the pairs in a `pending` list kept in FunctionalScript beside the
  generator;
- every `pending` pair **has no** entry, so landing a built-in fails the test
  until its pair leaves `pending`, and the list can only shrink toward empty;
- every pair in `prohibitedCalls` × prototype list **has no** entry. This is
  the design half: a refused name stays unanswerable;
- every known name that is no member function of a type **has no** entry on
  that type: a name of `prototypeNames` that the type's prototype list lacks,
  so an `Array` entry for `charAt` or `bind` fails the test and `[1].charAt(0)`
  throws as it does in JavaScript, and `length`, a property on neither call
  list, so `(1).length()` and `[].length()` throw too.

The test is unit-level because `method` is `pub(crate)`. The generated file is
included by `#[path]`, since a `gen.` name is not a Rust identifier, following
[naming generated files](../../CONTRIBUTING.md#naming-generated-files).

#### Known limitation, deferred by name

`flat(Infinity)` and `join` recurse once per nesting level. An array nested
deeply enough, built at run time with `reduce` for example, overflows the Rust
stack, and that is a crash, not a throw. It is the same shape as
[`fjs/edag/todo/stack-safety.md`](../../fjs/edag/todo/stack-safety.md) one layer
down. Per [AGENTS.md §5](../../AGENTS.md#5-pull-requests-and-releases) a crash
may be deferred behind a `todo/` that names the input, so the `flat` PR files
one, naming `flat(Infinity)` and `join` — and through `join`, `String(a)` and
the default `toSorted`, which converts each element — over a deep enough
`[[[…]]]`, rather than making the first implementation iterative.

### Open questions

1. **Printed corpus file name.** Method cases would land in
   `gen.operators.rs` beside the operators. Is that name acceptable for them,
   or does the corpus's Rust output get a name that covers both? A rename
   would be its own PR, not part of this stack.
2. **`toSorted` and implementation-defined order.** Is documenting it enough,
   as proposed, or should the language restrict or specify the comparator? The
   question belongs to a language designer and does not block anything here:
   the consistent-comparator behaviour is the same under every answer.

### Tasks

Each PR adds its built-ins under `vm/array/`, their `method.rs` entries, their
corpus cases, one harness fixture, and removes their pairs from `pending`. It
ticks their rows in [member-functions](./member-functions.md)' `Array`
checklist, names them in [`nanvm-lib/README.md`](../README.md)'s chains row,
and runs the full check set.

- [ ] **Infrastructure.** The method-call group, the callback vocabulary,
      structural expectations on both sides, and the generated completeness
      test with `pending` holding every pair not yet answered. No built-in
      lands here, and the test passes with the current table.
- [ ] **Search.** `includes`, `indexOf`, `lastIndexOf`, with `present`,
      the relative-index helper (`at` refactored onto it) and `SameValueZero`.
- [ ] **Copies.** `slice`, `concat`, `toReversed`, `with`, `toSpliced`, with
      the result-length `RangeError`.
- [ ] **`join`.** `arr_to_string` becomes `Array::join` with `","`.
- [ ] **Iteration.** `every`, `some`, `find`, `findIndex`, `findLast`,
      `findLastIndex`, `map`, `filter`, with the callback check ahead of the
      visit and `thisArg` accepted with no effect.
- [ ] **Folds.** `reduce`, `reduceRight`.
- [ ] **Flattening.** `flat`, `flatMap`, and the deferred-recursion `todo/`
      above.
- [ ] **`toSorted`.** The stable merge sort, and the
      [`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md) row
      amended with the implementation-defined note.
- [ ] Delete this file when the `Array` section of
      [member-functions](./member-functions.md) is fully ticked.

### Related

- [member-functions](./member-functions.md): the call-step machinery, the
  per-type checklist this file specifies the `Array` part of, and the
  `Function` `toString` item `join` and `toSorted` depend on for function
  elements.
- [`fjs/js/prototype/README.md`](../../fjs/js/prototype/README.md): every
  prototype name, allowed or refused, with its reason.
- [`fjs/nanvm/README.md`](../../fjs/nanvm/README.md): the shared corpus these
  cases join.
- [`fjs/edag/operations`](../../fjs/edag/operations/module.f.mjs):
  `callProperty`, the host side of a method call.
- [new-array-out-of-subset](../../todo/new-array-out-of-subset.md): why no
  array has holes.
- [`fjs/edag/todo/stack-safety.md`](../../fjs/edag/todo/stack-safety.md): the
  same recursion hazard in the compiler.
