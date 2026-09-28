## deep-rule-chain. `firstOf` and `reach` recurse once per rule of a chain

**Priority:** P4
**Status:** open

### Problem

Two walks in [`../module.f.mjs`](../module.f.mjs) take one stack frame, or
several, per rule they pass through:

- `firstOf` recurses into every item in first position, so its depth is the
  longest chain of rules each beginning with the next;
- `reach` recurses into every rule it has not found yet, so its depth is the
  longest path of references from the entry.

The input that breaks it, on Node 22: a chain of 1000 rules
`r<i>: ['sequence', 'r<i+1>']` ending in a set. `parserRuleSet(ruleSet, 'r0')`
throws `RangeError: Maximum call stack size exceeded` inside `firstOf`; a chain
of 900 passes. `reach` runs first and gets through 1000, but a chain of 10000
overflows it too.

`followMap`'s fixpoint had the same hazard, one frame per round, and now runs
through `../data`'s loop-based `_fixpoint`. That removed a recursion, not this
limit: on a chain, `firstOf` overflows first.

### Proposal

Each walk becomes a loop over an explicit worklist, as `_fixpoint` in
[`../../data/module.f.mjs`](../../data/module.f.mjs) is: `reach` is a plain
graph search; `firstOf` also has to detect left recursion, so its worklist
carries the rules still being computed, which is what `current` holds today.

### Tasks

- [ ] `reach` over a worklist.
- [ ] `firstOf` over a worklist, still refusing `left recursion` naming the
      rule.
- [ ] A proof: a chain of some thousands of rules builds a parser.
- [ ] `tsc`, `fjs test`, `node --test`.

### Related

- [../../data/todo/deep-nesting.md](../../data/todo/deep-nesting.md) — the
  stack safety of `../data`'s own walkers.
