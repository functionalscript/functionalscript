# Object Spread

**Priority:** P2
**Status:** open — approved, front end not implemented

A spread member in an object literal, as JavaScript writes it:

```js
const o = { a: 1, b: 2 };
export default [{ ...o, c: 3 }, { a: 0, ...o }, { ...o, a: 0 }, { ...'ab' }, { ...null }];
// [{ a: 1, b: 2, c: 3 }, { a: 1, b: 2 }, { a: 0, b: 2 }, { 0: 'a', 1: 'b' }, {}]
```

## Proposal

Accept JavaScript's spread member, `...` followed by any value, among an
object literal's members: at any position, any number of times, a trailing
comma allowed as it is today. The members are read by `members` in
[`fjs/compiler/parser/grammar`](../../fjs/compiler/parser/grammar/module.f.mjs),
whose item becomes a choice of a property, `key: value`, and a spread,
`...value`. A spread lowers to the EDAG's existing spread entry, `['...', exp]`,
a property of `['{}', properties]`:

| JS | EDAG |
|---|---|
| `{ ...o, c: 3 }` | `['{}', [['...', o], [':', 'c', 3]]]` |
| `{ a: 0, ...o }` | `['{}', [[':', 'a', 0], ['...', o]]]` |

A spread member has JavaScript's value, `CopyDataProperties`: the operand is
evaluated in its place among the members, left to right, and its own
enumerable string-keyed properties are copied in, in its own property order
([nodes](../../fjs/edag/README.md#nodes)). A copied key behaves as a
written one: when it is already present, the later value wins and the key
keeps its first position, as `{ x: 1, x: 2 }` does today. So
`{ a: 0, ...{ a: 1 } }` is `{ a: 1 }`, and `{ ...{ a: 1 }, a: 0 }` is
`{ a: 0 }`. What each value contributes agrees with JavaScript:

- **An object:** its own properties, array-index keys first in ascending
  order, then the others in the order they were made — `JSON.stringify`'s
  order, which `nanvm-lib` reads through the same view.
- **An array:** its elements, keyed `'0'`, `'1'`, ….
- **A string:** one property per UTF-16 code unit, not per code point:
  `{ ...'😀' }` is `{ 0: '\ud83d', 1: '\ude00' }`, where `[...'😀']` is
  `['😀']`. The two spreads read a string differently in JavaScript, and so
  here.
- **Anything else** — `null`, `undefined`, a boolean, a number, a `bigint`,
  a function — contributes nothing: `{ ...null }` is `{}`.

So, unlike an array spread, an object spread never throws. A
FunctionalScript value has no getters, no symbol keys and no non-enumerable
property a module can make, so none of JavaScript's other cases arises.

A copied `__proto__` key is an ordinary own property, as JavaScript's
`CreateDataProperty` makes it: `{ ...{ ['__proto__']: 1 } }` owns a property
named `__proto__` and has no new prototype. That is the meaning the
bracketed spelling already has ([the `__proto__`
key](../README.md#the-__proto__-key)), so no rule changes.

Nothing else changes: a key is still a constant, and object rest in a
destructuring pattern, `const { a, ...r } = o`, is
[destructuring](./2450-destructuring.md)'s.

Each output writes the graph as it writes any other:

- `.js` and `.f.js` write the spread back, `{ ...o, c: 3 }`.
- `.json` and `.data.js` write the value, the spread already evaluated.
- The EDAG's `.edag.data.js` keeps the `['...', exp]` entry.
- `.rs` prints it through `nanvm-lib`'s
  [`object_spread`](../../nanvm-lib/todo/spread-operations.md), as
  `spread_object`, an `Any` rather than a `Result`, since it never throws
  (#2496).

Constant spreads are not folded, so `{ ...{ a: 1 } }` is a different graph
from `{ a: 1 }` and hashes differently, as `[...[1]]` and `[1]` do.

## Benefits

- **Familiar code compiles.** At `93ed6ba`, about 84 of the 406 `.f.mjs`
  modules use object spread, about 610 occurrences, as
  [array spread](./2480-spread.md) counted them; a cruder line scan of the
  same commit, in the review of #2484, found 78 modules. Every one of them
  is refused today.
  Among the leaf modules, it is one of the blockers of `fjs/git/config`.
- **The rest of the pipeline is ready.** The EDAG, its analysis, the
  JavaScript evaluator and the Rust printer take an object's spread entry
  already (#2460, #2496). This adds the grammar rule, the lowering, the
  `.js` writer's spelling, and the spread to the AST that the `.json` and
  `.data.js` outputs evaluate and analyse, which reads every member as a
  `[key, value]` pair today.
- **It is how an object is updated.** Values are immutable, so a changed
  copy, `{ ...o, x: 1 }`, is the one way to change one property and keep the
  rest; without it a module lists every key by hand.

## Drawbacks

- **The same `...` means two things.** Inside `[]` it iterates and may
  throw; inside `{}` it copies properties and never throws, and a string is
  code points in one and code units in the other. That is JavaScript's own
  split, kept rather than smoothed over, so a module means one thing in both
  languages.
- **An object's keys depend on a value.** Without a spread, an object
  literal's keys are its constants; with one, they are known only once the
  operand is. The compiler already reads keys statically: the sharing and
  anchoring sweeps in [`fjs/compiler/ast`](../../fjs/compiler/ast/module.f.mjs)
  keep the last member per key (`memberValues`) and resolve an access into
  an object literal to the member it names (`literalAt`, `selected`). With
  a spread, `[o.x, { ...o }.x]` reaches `o.x` twice, and a member that
  seems to win may lose to a later spread, so those reads have to keep
  every spread operand and treat the literal's keys as unknown — as array
  and call spread already treat an array holding a spread, which no key
  selects inside.
- **JavaScript compatibility.** None lost. The change only accepts
  JavaScript, with JavaScript's values.

## Out of scope

- **Object rest**, `const { a, ...r } = o`, which is
  [destructuring](./2450-destructuring.md)'s.
- **Shorthand members**, `{ a }`, which are [shorthand](./2440-shorthand.md)'s.
- **Computed keys** from an expression, `{ [k]: v }`: a key stays a
  constant.

## Approval

Approved by Sergey Shandar (@sergey-shandar), language designer, on
2026-10-02, in the
[Claude Code session](https://claude.ai/code/session_01NHkT6r3jWYESeWwhL8x6tk)
that wrote both spread proposals: "do the draft and add my approval
there" for object spread, then "yes, add my approval to 2480 too" — and
on #2514, the pull request that records both:
["I approve."](https://github.com/functionalscript/functionalscript/pull/2514#discussion_r4167432048)
[DESIGN.md §12](../../doc/DESIGN.md#new-language-features-start-with-a-todo)
asks for formal, explicit approval from a language designer other than the
proposer before implementation; this proposal was written by Claude.

## Tasks

- [x] Language-design approval, recorded above.
- [ ] Grammar: the item of `members` in
      [`fjs/compiler/parser/grammar`](../../fjs/compiler/parser/grammar/module.f.mjs)
      a choice of a property and a spread, `['...', value]`, checked to stay
      LL(1): `...` begins no key.
- [ ] AST and lowering: a spread member in the object node of
      [`fjs/compiler/ast`](../../fjs/compiler/ast/module.f.mjs), lowered to
      `['...', exp]` by [`fjs/compiler/edag`](../../fjs/compiler/edag/module.f.mjs).
- [ ] Value evaluator: `toDjs` in
      [`fjs/compiler/ast`](../../fjs/compiler/ast/module.f.mjs), which the
      `.json` and `.data.js` outputs run, copies a spread's own properties
      into the object in its place, as `CopyDataProperties` does: an
      object's in own-property order, an array's elements by index, a
      string's code units, and nothing from every other value.
- [ ] AST analysis: an object literal holding a spread selects no key
      (`selectable`), a member before a spread is not dropped as shadowed,
      and every spread operand is kept and read as `CopyDataProperties`
      copies it — its own properties, each one key deeper — in the sharing,
      anchoring and capture sweeps of
      [`fjs/compiler/ast`](../../fjs/compiler/ast/module.f.mjs); proofs
      that `[o.x, { ...o }.x]` and two spreads of one object are refused as
      JSON where `o.x` is a container, and written where it is not.
- [ ] `.js` writer: spell a spread member, `...x`, in
      [`fjs/compiler/serializer`](../../fjs/compiler/serializer/module.f.mjs),
      which refuses it today (`a spread`), and read back to the same graph.
- [ ] Proofs: spreads of an object, an array, a string with a surrogate
      pair, and each value that contributes nothing; a spread at the start,
      the middle and the end; two spreads; a key a later spread or property
      overrides, keeping its first position; a trailing comma; a copied
      `__proto__` key; and each output's spelling.
- [ ] Spec: the [objects](../README.md#objects) section accepts spread, and
      the roadmap's entry is dropped.
- [x] Rust: [`object_spread`](../../nanvm-lib/todo/spread-operations.md) in
      `nanvm-lib`, and the Rust printer printing a spread entry through it,
      as `spread_object` (#2496).
- [ ] A `nanvm-harness` fixture compiled from source with object spreads,
      checked against a JavaScript engine, once the front end lands.

## Related

- [array and call spread](./2480-spread.md): the same `...` in `[]` and a
  call's arguments.
- [spread operations](../../nanvm-lib/todo/spread-operations.md): the
  `nanvm-lib` side, `get_iterator` and `object_spread`.
- [`fjs/edag/README.md`](../../fjs/edag/README.md): the spread entry.
