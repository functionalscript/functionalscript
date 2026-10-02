# Array and Call Spread

**Priority:** P2
**Status:** open — approved, front end not implemented

A spread item in an array literal and in a call's arguments, as JavaScript
writes it:

```js
const a = [1, 2];
const f = (...x) => x;
export default [[0, ...a, 3], f(...a, 4), [...'ab']];
// [[0, 1, 2, 3], [1, 2, 4], ['a', 'b']]
```

## Proposal

Accept JavaScript's `SpreadElement` in an array literal and in a call's
`Arguments`: `...` followed by any value, at any position, any number of
times, a trailing comma allowed as it is today. Both places read the same
grammar rule, `values` in
[`fjs/compiler/parser/grammar`](../../fjs/compiler/parser/grammar/module.f.mjs),
so the two land together, and both lower to the EDAG's existing spread item,
`['...', exp]` — an item of `['[]', items]` and, since #2466, of a call's
argument list:

| JS | EDAG |
|---|---|
| `[0, ...a]` | `['[]', [0, ['...', a]]]` |
| `f(...a, 4)` | `['()', f, [['...', a], 4]]` |
| `o.m(...a)` | `['.', o, 'm', ['\|()', [['...', a]]]]` |

A spread item has JavaScript's value: the operand is evaluated in its place
among the items, left to right, and then iterated, each value it yields
becoming one item ([nodes](../../fjs/edag/README.md#nodes)). The
values FunctionalScript has split into two classes, and both agree with
JavaScript:

- **Iterable:** an array yields its elements in index order, and a string
  yields its code points, each a string of its own: `[...'😀']` is `['😀']`,
  one item of two code units.
- **Not iterable:** every other value — `null`, `undefined`, a boolean, a
  number, a `bigint`, an object, a function — throws, before any item after
  it is evaluated, as JavaScript's `GetIterator` throws a `TypeError`. A
  FunctionalScript object cannot define `Symbol.iterator`, so no object is
  iterable here, and none is in JavaScript either.

Nothing else changes:

- A rest parameter, `(...x) => x`, stays what it is. The parameter list is
  read by another rule, and a `...` after a call's `(` or an array's `[` is
  read by `values` alone.
- Every callee still builds its own rest array from the arguments, so
  `(...r) => f(...r)` forwards the values and never the array.

Each output writes the graph as it writes any other:

- `.js` and `.f.js` write the spread back, `[0, ...a]` and `f(...a)`.
- `.json` and `.data.js` write the value, the spread already evaluated.
- The EDAG's `.edag.data.js` keeps the `['...', exp]` item.
- `.rs` prints a spread item through `nanvm-lib`'s
  [`get_iterator`](../../nanvm-lib/todo/spread-operations.md), as
  `spread_array` or `spread_call`, each a `Result` since a spread can
  throw.

Constant spreads are not folded, so `[...[1, 2]]` is a different graph from
`[1, 2]` and hashes differently, as `1 + 1` and `2` do.

## Benefits

- **Familiar code compiles.** At `93ed6ba`, about 148 of the 406 `.f.mjs`
  modules use array spread, about 1,090 occurrences, and about 28 use call
  spread, about 60 occurrences — a bracket-aware count from the review of
  #2470, where a cruder scan gave 143 and 27. Every one of them is refused
  today. Among the
  leaf modules, it is one of the two blockers of `fjs/js/keywords`.
- **The rest of the pipeline is ready.** The EDAG, its analysis and the
  JavaScript evaluator take spread items already (#2460, #2466). This adds
  only the grammar rule, the lowering and the `.js` writer's spelling.
- **One rule for arrays and calls.** Since #2466 a call's arguments are the
  item list an array holds, so a spread means the same in both places, by
  construction.

## Drawbacks

- **A spread can fail where an item cannot.** `[...1]` throws, where `[1]`
  never does. JavaScript has the same failure, so a module still means one
  thing in both languages.
- **JavaScript compatibility.** None lost. The change only accepts
  JavaScript, with JavaScript's values.

## Out of scope

- **Object spread**, `{...o}`, about 610 occurrences in 84 modules. It
  copies own properties rather than iterating, needs its own rule in
  `members`, and is [object spread](./2490-object-spread.md)'s.
- **Spread in other places JavaScript allows it:** a `new` expression's
  arguments, since there is no `new`; destructuring and its rest element,
  which is [destructuring](./2450-destructuring.md)'s.
- **Holes**, `[1, , 2]`, which stay refused: an array has no holes.

## Approval

Approved by Sergey Shandar (@sergey-shandar), language designer, on
2026-10-02, in the
[Claude Code session](https://claude.ai/code/session_01NHkT6r3jWYESeWwhL8x6tk)
that wrote both spread proposals: "do the draft and add my approval
there" for object spread, then "yes, add my approval to 2480 too".
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
asks for formal, explicit approval from a language designer other than the
proposer before implementation; this proposal was written by Claude.

The approval gates the language feature: the grammar, the lowering and the
`.js` writer, the steps that let a module spell a spread. It does not gate
the backends. The EDAG's spread item exists already (#2460, #2466), and
each output follows the EDAG, so the JavaScript evaluator and the Rust
printer read it before any source can produce it.

## Tasks

- [x] Language-design approval, recorded above.
- [ ] Grammar: a spread alternative, `['...', value]`, in the item of
      `values` in
      [`fjs/compiler/parser/grammar`](../../fjs/compiler/parser/grammar/module.f.mjs),
      checked to stay LL(1): `...` begins no value.
- [ ] AST and lowering: a spread item in the array and call nodes of
      [`fjs/compiler/ast`](../../fjs/compiler/ast/module.f.mjs), lowered to
      `['...', exp]` by [`fjs/compiler/edag`](../../fjs/compiler/edag/module.f.mjs).
      A call with a spread is never inlined.
- [ ] `.js` writer: spell a spread item, `...x`, in an array and in a
      call's arguments, in
      [`fjs/compiler/serializer`](../../fjs/compiler/serializer/module.f.mjs),
      which refuses it today (`a spread`), and read back to the same graph.
- [ ] Proofs: spreads of an array and a string, a spread at the start, the
      middle and the end, two spreads, a trailing comma, a method call's
      spread, forwarding `(...r) => f(...r)`, each refused operand kind
      throwing, and each output's spelling.
- [ ] Spec: the [arrays](../README.md#arrays) and
      [functions](../README.md#functions) sections accept spread, and the
      roadmap's entry is dropped.
- [x] Rust: [`get_iterator`](../../nanvm-lib/todo/spread-operations.md) in
      `nanvm-lib` (#2472), and the Rust printer printing a spread item
      through it, as `spread_array` and `spread_call` (#2484).
- [ ] A `nanvm-harness` fixture compiled from source with spreads,
      checked against a JavaScript engine, once the front end lands.

## Related

- [spread operations](../../nanvm-lib/todo/spread-operations.md): the
  `nanvm-lib` side, `get_iterator` and `object_spread`.
- [`fjs/edag/README.md`](../../fjs/edag/README.md): the spread item and a
  call's argument list.
