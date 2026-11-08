## The small facts of the FAST vocabulary, owned once

**Priority:** P3
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) owns the FAST vocabulary and a few facts
about it, `isSpread` and `operatorOperands` among them. Four more facts are
re-spelled by the passes that need them, each in several modules:

**A plain call of a member is a continued access.** `['()', ['.', base,
key], args]` is the same computation as `['.', base, key, ['|()', args]]`,
and the rewrite is written in `valueTask` and `_exposeOperands` of
[`returns`](../returns/module.f.mjs), `prepareValue` of
[`prepare`](../prepare/module.f.mjs), `sequencedOperator` of
[`sugar`](../sugar/module.f.mjs) and `valueTask` of
[`fjs/edag/from_fast`](../../../edag/from_fast/module.f.mjs); `guarded` in
[`memo`](../memo/module.f.mjs) asks the test without the rewrite:

```js
// returns: valueTask
if (source[0] === '()' && source[1] instanceof Array && source[1][0] === '.' && source[1].length === 3) {
    const member = source[1]
    return bind(chainTask(['.', member[1], member[2], ['|()', source[2]]], destination, owner, permitted), …
// from_fast: valueTask
if (root[0] === '()' && root[1] instanceof Array && root[1][0] === '.' && root[1].length === 3) {
    return valueTask(['.', root[1][1], root[1][2], ['|()', root[2]]], context)
```

**`?:` is `if` over two yielding arms.** `valueTask` in `memo` and in
`returns`, and `prepareValue`'s `'?:'` case, each build the arms:

```js
const then = source[0] === 'if' ? source[2] : ({ statements: [], exit: ['yield', [source[2]]] })
const otherwise = source[0] === 'if' ? source[3] : ({ statements: [], exit: ['yield', [source[3]]] })
```

**The block that yields one value.** `{ statements: [], exit: ['yield',
[value]] }` is spelled inline at about thirty sites under `fjs/js/ast` and
`fjs/edag` at `d7bead6`, while [`sugar/logical`](../sugar/logical/module.f.js)
keeps a private `yielded` for it.

**A value is a reference to a binding.** `value instanceof Array &&
value[0] === 'ref' && value[1] === binding` is exported as `namesBinding`
from [`fjs/edag/from_fast/loop`](../../../edag/from_fast/loop/module.f.mjs),
which the `fjs/js/ast` modules may not import
([compiler-layer-upward-imports](../../../todo/compiler-layer-upward-imports.md)),
so [`loop`](../loop/module.f.js), [`loop/invariant`](../loop/invariant/module.f.mjs)
and [`invocation`](../invocation/module.f.js) each keep a private `names`,
`prepare` spells it inline against `loop.parameters[0]`, and `sameTest` in
[`fjs/edag/to_fast/join`](../../../edag/to_fast/join/module.f.mjs) spells
it against a second reference. The export in the wrong layer is what makes
the copies, which is the case [AGENTS.md §1](../../../../AGENTS.md#1-workflow)
names. The `ref` constructor itself is a private `ref` or `reference` in
`memo`, `returns` and `sugar`.

Each of these is a statement about the vocabulary, not about any pass; a
change to the chain encoding or to `Exit` reaches five modules today.

### Proposal

Beside `isSpread` and `operatorOperands` in `module.f.mjs`:

```ts
memberCall: (value: Value) => ContinuedAccess | null   // ['.', base, key, ['|()', args]] or null
conditionalArms: (value: Value) => { test, then, otherwise } | null   // for `if` and `?:`
yielded: (value: Value) => Block
isRefTo: (value: Value, binding: BindingId) => boolean   // `namesBinding`, moved down
ref: (binding: BindingId) => Value
```

`namesBinding` is deleted from `from_fast/loop` and its importers take
`isRefTo`; the three `names` and the inline spellings go; `sugar/logical`'s
`yielded` becomes the import. A call site reads `const chain =
memberCall(source); if (chain !== null) { … }` instead of the four-clause
test and the rebuilt array.

### Tasks

- [ ] `memberCall`, `conditionalArms`, `yielded`, `isRefTo` and `ref`
      exported with proofs.
- [ ] The member-call sites in `returns`, `prepare`, `sugar`, `memo` and
      `from_fast`.
- [ ] The `?:` arms in `memo`, `returns` and `prepare`.
- [ ] `namesBinding`'s importers and the three `names`; delete the export.
- [ ] The inline `yielded` blocks, as they are touched.
- [ ] `tsc` and the suites under `fjs/js/ast` and `fjs/edag`.

### Related

- [fast-children-once](./fast-children-once.md) — the children table, the
  same kind of fact, already moving here.
- [`fjs/edag/todo/operand-classification-owner`](../../../edag/todo/operand-classification-owner.md)
  — the EDAG-side operand classes, the other side of the boundary.
