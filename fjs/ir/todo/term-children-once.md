## A term's children, stated once

**Priority:** P3
**Status:** open

### Problem

[`module.f.js`](../module.f.js) exports `terms`, the terms a `Term`
holds, and `inside`, the same for a typed term. The two switch bodies
are identical line for line; only the JSDoc type differs.

Around them, passes re-spell the child table for one node kind's sake:

- `bound` in [`lifetime`](../lifetime/module.f.js) is a switch over
  every kind that answers a node's binders and the `bound` of each child.
  Only `let`, `match` and `loop` have binders; the other cases restate
  `inside`. Its answer is used as a set, so it is
  `[...binders(t), ...inside(t).flatMap(bound)]`.
- `bound` in [`inline`](../inline/module.f.js) is that expression
  already, over `inside`, with a `block`'s label among the binders, and
  its `write` and `expand` rebuild every node kind twice
  ([one walker for the inline pass](../inline/todo/one-walker.md)).
- `renamed` (the one walker that `link`, `linkAny` and `linkString` share) in [`from_fast/link`](../from_fast/link/module.f.js)
  rebuilds every node kind to change a few: `call`, `code` and
  `constant`.
- `named` in `lifetime` threads a counter through the children of
  `let`, `op`, `make`, `field`, `variant` and `block` and rebuilds the
  node unchanged.
- `emit` in [`wasm`](../wasm/module.f.js) writes "every function's body,
  then every constant's term" once per collector
  (`literalsOf`, `codesOf`, `hasCallRef`, `blockTypes`, `callRefTypes`).
- "What a term names of its own module" is collected separately by
  `uses` in `from_fast/link`, `reads` in `from_fast`, `uses` in
  [`check`](../check/module.f.js).

A new term kind is an edit to each of these switches, and one that
forgets `bound` hands the lifetime pass a fresh name that is not fresh.

### Proposal

Beside `terms`:

- one child table, generic over the child, so `terms` and `inside` are
  one function;
- its inverse, `withTerms(t, parts)`: the node rebuilt over new
  children. `renamed` is then the cases it changes and
  `withTerms(t, terms(t).map(go))`, and `named`'s pass-through
  cases are its default;
- `binders(t)`, so `bound` is one expression;
- in `emit`, one `bodies` list that the collectors map over.

`free` in `lifetime` knows scopes and stays as it is.

This is [the FAST children table](../../js/ast/todo/fast-children-once.md)
and [the postorder fold](../../js/ast/control/todo/postorder-fold.md)
over again, one representation down; whatever shape those settle on is
the one to copy.

### Drawbacks

- `Term` and `TypedTerm` are separate unions in [`types.ts`](../types.ts):
  an `op` carries its `target` only where untyped, and an arm has three
  parts or four. One generic table needs a `NodeOf<T>` type, and a
  recursive alias through another alias is the TS2456 that
  [fjs/AGENTS.md](../../AGENTS.md) warns of. The fallback, one body and
  a cast, is what the style guide discourages. If the type does not
  come out clean, `withTerms` and `bodies` are still worth having and
  the two tables stay two.
- `withTerms` must keep an `op`'s optional fourth element and an arm's
  `written` slot, or it silently drops them.
