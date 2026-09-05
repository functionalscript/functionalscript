## data-nullable-fixpoint-reuse. `ll1` re-implements `data`'s `nullable` and `fixpoint` — the fixpoint less safely

**Priority:** P4
**Status:** open

### Problem

Two helpers `../data` already owns are re-implemented in
`fjs/ebnf/ll1/module.f.mjs`, and one re-implementation drops a safety
property its original documents.

`nullable` is a pure copy — same body, same "own entry only" rationale in
the doc comment, which even cites `../data` as the source
(`data/module.f.mjs:80-86` vs `ll1/module.f.mjs:51-57`):

```js
const nullable = map => item => at(item)(map) !== null   // data
const nullable = empty => name => at(name)(empty) !== null // ll1
```

The relaxation fixpoint exists twice, and the copies disagree on stack
safety. `data`'s (`data/module.f.mjs:116-132`) is a generic
`(step, names)` **loop**, with the reason in its JSDoc: a chain of rules
each naming the next advances one fact per round, "so the rounds are as
many as the rules, and a recursion that deep is a stack overflow on a few
thousand." `ll1`'s `followMap` re-derives the same relax-until-stable as a
**recursion** (`ll1/module.f.mjs:219-223`) and inherits exactly the
overflow the original's comment warns about, on the same grammar shape.
(`reach`, `ll1:173-175`, recurses per reached rule too — same hazard, its
own fix.)

### Proposal

Export `nullable` and `fixpoint` from `fjs/ebnf/data` — both are already
described in `ll1`'s prose as `../data`'s rules — and express `followMap`
as `fixpoint(step, names)(fromEntries(...))`. The `EmptyTagMap`-specific
signature of `data`'s `fixpoint` generalizes to the `FirstMap` case (both
are "map, step, per-name stability check"); if the generalization fights
the types, a second monomorphic export still beats a recursion with a
documented overflow.

### Tasks

- [ ] Export the two helpers from `data`; delete `ll1`'s copies; `followMap`
      goes through the loop-based fixpoint.
- [ ] Consider `reach`'s recursion in the same pass, or file it separately.
- [ ] `tsc`, `fjs t`.

### Related

- [../../data/todo/deep-nesting.md](../../data/todo/deep-nesting.md) —
  stack safety of `data`'s own walkers; scopes itself to `toData` and does
  not reach `ll1`'s `followMap`/`reach`, which is why this is a separate
  issue.
