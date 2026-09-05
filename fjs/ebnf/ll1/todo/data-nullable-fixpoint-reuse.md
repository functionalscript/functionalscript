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
through the loop-based fixpoint.

**The equality is part of the generalization, not a detail.** `data`'s
`fixpoint` decides stability with `at(name)(next) === at(name)(current)`,
which is right for `EmptyTagMap`'s values but wrong for `FirstMap`'s:
those are `RangeSet` arrays, and `union` builds a fresh array even when
the contents stop changing, so the `===` loop would never terminate. The
shared helper must take the per-entry equality as a parameter — `data`
passing `===`, `ll1` passing its `structurallySame` (or a `RangeSet`
equality) — or, if that parameterization fights the types, `ll1` keeps a
monomorphic **loop** with `structurallySame`, which still removes the
recursion-depth hazard even though it shares only the shape. Replacing the
existing terminating recursion with the exported loop as-is would trade a
stack overflow for an infinite loop.

### Tasks

- [ ] Export the two helpers from `data`, with the stability equality as a
      parameter; `followMap` goes through the loop-based fixpoint with a
      structural `RangeSet` equality, `data` keeps `===`.
- [ ] Consider `reach`'s recursion in the same pass, or file it separately.
- [ ] `tsc`, `fjs t`.

### Related

- [../../data/todo/deep-nesting.md](../../data/todo/deep-nesting.md) —
  stack safety of `data`'s own walkers; scopes itself to `toData` and does
  not reach `ll1`'s `followMap`/`reach`, which is why this is a separate
  issue.
