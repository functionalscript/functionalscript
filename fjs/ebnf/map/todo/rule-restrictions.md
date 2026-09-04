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

#### Replacement is not one of them

A fourth answer suggests itself and does not work. `repeat(0, 0)(R)`
matches what `[]` matches and has the AST `[]` has — `Ast` gives both
`readonly []` — so replacing the one rule by the other looks free, and
would answer the zero-round case by leaving no item to check at all.

It breaks the monotonicity `Ast` is built on. `Ast` is monotone in its
rule: `A extends B` implies `Ast<A> extends Ast<B>`, which `_Mono` in
[`../../ast/types.ts`](../../ast/types.ts) pins. A bounded repetition
refines the unbounded one — `Repeat<0, 0, D> extends Repeat<0, number, D>`,
since `0 extends number` — and `Ast` carries the refinement through, as
`readonly []` extends `readonly Ast<D>[]`. The empty tuple refines
nothing of the sort: `readonly []` is no `Repeat`, so it stands in no
relation to `Repeat<0, number, D>` at all. The replacement takes a rule
from under a repetition it refined and puts it beside that repetition,
and a consumer reasoning "a narrower rule has a narrower AST" can no
longer reason through it.

So every answer above keeps the rules the author wrote. The same binds a
*normalizer* — the opt-in one
[ebnf-migration](../../../todo/ebnf-migration.md) leaves open for
`ebnf/data/` — which may replace a rule only by one that sits where the
original sat, and owes an `Assert` saying so
([fjs/AGENTS.md §1.4](../../../AGENTS.md#14-assert-type-level-facts-with-assertequal)):
there is nothing to attach one to until such a rewrite exists, which is
why this is prose here and a check there.

### Tasks

- [ ] Decide which of the three the rewrite promises. Not by replacing
      rules: that loses the order `Ast` is monotone in, above.
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
