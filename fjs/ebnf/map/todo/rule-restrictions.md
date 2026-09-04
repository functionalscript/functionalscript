## rule-restrictions. How far does the rewrite restrict a rule?

**Priority:** P3
**Status:** open

### Problem

A `Rule` is what the front end's types admit, and a *valid* rule is less
than that: the lowering in [`../../data`](../../data/README.md) refuses an
info that is no tuple, a `const` over a thunk, a set whose boundaries are
outside the domain, a repetition whose bounds are, a number that is no
symbol, a string of malformed UTF-16. `rewrite` has grown a refusal for
each of those as a reviewer named it, so today it refuses what the walk
happens to read — and only that.

Two things follow, and neither is decided.

**The walk validates what the AST exercises.** A rule the AST never
reaches is never read, so never checked: `() => ['repeat', 0, 0, true]`
against `[]` maps no rounds and returns `[]`, where the lowering refuses
`true` as no rule. An unselected variant branch is the same — `{ a: 'x',
b: true }` against `['a', …]` walks `a` and never sees `b` — and so is
anything inside such a subtree, at any depth. No check inside an arm
closes this, because the arms are where the walk goes.

**The refusals restate the lowering.** Each one names the same condition
`toData` names, in a second place, with its own message. That is eight
conditions so far and the list is not obviously closed — a `Map` as a
rule, for instance, reads here as a variant with no branches, and the
lowering reads it the same way, so neither refuses it and nothing says
whether either should.

### Proposal

Decide what `rewrite` promises about a rule, then make the code say it.
The options, from least to most:

1. **The types are the contract.** `rewrite` promises nothing about a
   rule beyond what `Rule` admits, and a malformed rule is the caller's
   mistake, as it is for any function whose argument type is wider than
   its domain. Today's refusals stay as the accidents they are, or go.
   The README says a rule is validated by `toData` and a backend, not
   here.
2. **Refuse where the walk reads, and say so.** What is written today,
   made deliberate: a rule the AST exercises is checked, and one it does
   not is not. Cheap, and the contract is odd to state — validity would
   depend on the input, not the grammar.
3. **Validate the rule, once, whole.** `rewrite` walks the rule graph
   before it walks the AST, refusing the same rules the lowering refuses.
   The complete answer, and the one that stops this list growing; the
   cost is a second walk and the question of where the validator lives —
   almost certainly shared with `toData`'s rather than restated, which
   makes it a change to [`../../data`](../../data/README.md)'s surface
   and its own pull request.

Whichever wins, the per-condition refusals stop being decided one
reviewer comment at a time, which is what this issue exists to end.

### Tasks

- [ ] Decide which of the three the rewrite promises.
- [ ] Apply it: extend, prune, or replace the refusals in
      [`../module.f.mjs`](../module.f.mjs) to match, and say the promise
      in [`../README.md`](../README.md).
- [ ] If it is the third, settle where the shared validator lives, in a
      pull request of its own.

### Related

- [`../README.md`](../README.md) — what the rewrite refuses today.
- [`../../data/README.md`](../../data/README.md) — "What `validate`
  refuses", the list this one mirrors.
- [exact-key-types](./exact-key-types.md) — the same question for a
  *key*, which is a rule the walk never reads at all.
