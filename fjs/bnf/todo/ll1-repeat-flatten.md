## `bnf/ll1`: emit a flat AST for `repeat` rules

**Priority:** P3
**Status:** blocked
**Blocked by:** [New parser backend](./new-parser.md)

### Problem

`bnf/data` now derives a `Repeat` rule from the unambiguous 0-or-more shape, and
`bnf/descent` matches it iteratively: a repetition is one AST node holding a flat
sequence of the items it matched. `bnf/ll1` does not follow. `dispatchMap`
compiles a `Repeat` back into the right-recursive chain it was folded from —
dispatch on the item's first set, then the item's own chain followed by the
repeat rule again — so this backend's AST keeps the nested shape, and a
repetition's node tags are the item's rather than the `some`/`none` they used to
be.

That is a dispatch-model limitation, not a missing branch. A dispatch entry
*consumes* the symbol it dispatched on and continues with a chain of rule names,
so the first symbol of a nullable item is inlined into whatever encloses it. A
repetition that leads a sequence — `[ws, value, ws]`, the shape of every grammar
in `bnf/testlib.f.mjs` — has its first set merged into that sequence's own
entries, and the rules chain those entries carry is the only thing left to carry
the repetition. A frame that loops is unreachable from there.

Making only the *non-inlined* references iterative would be worse than leaving it
alone: the same grammar would then produce a flat repeat node in one position and
a nested chain in another, so nothing downstream could rely on either.

### Proposal

Do not patch the dispatch model for this. Either

- a rules chain gains a step that names a repetition rather than a rule, so an
  inlined entry can say "item continuation, then loop this repeat, then the
  enclosing continuation", and the matcher owns the node boundaries; or
- the backend moves to a predictive table over an explicit stack of rule
  invocations, where a rule is entered before its first symbol is consumed and a
  repetition is an ordinary frame.

The second is the classic LL(1) shape and is what [new-parser](./new-parser.md)
already contemplates, so this task should be settled there rather than as a
separate rewrite of the current dispatch builder. Until then `bnf/ll1` keeps the
right-recursive expansion, which is behavior-preserving.

### Tasks

- [ ] Decide the dispatch model with [new-parser](./new-parser.md) — a
      repetition-aware rules chain, or rule invocations on an explicit stack.
- [ ] Match `repeat(item)` iteratively in `parserRuleSet` and emit one node
      holding a flat `AstSequence` of the items, matching `bnf/descent`.
- [ ] Remove the right-recursive expansion from `dispatchMap` once the matcher no
      longer needs it.
- [ ] Prove that the same grammar gives both backends the same repetition shape,
      including a repetition in a sequence's nullable prefix.
- [ ] `npx tsc`, `fjs test`.

### Related

- [`fjs/bnf/data/README.md`](../data/README.md#the-repeat-rule) — what the fold
  recognizes and why it is limited to the unambiguous 0-or-more case.
- [`fjs/bnf/ll1/README.md`](../ll1/README.md#repetition-is-not-flat-here) — the
  shipped behavior and the dispatch-model obstacle.
- [`fjs/bnf/descent/README.md`](../descent/README.md#repetition-is-flat) — the
  flat shape this backend should reach.
- [New parser backend](./new-parser.md) — where the dispatch model is decided.
- [BNF semantic actions](./207.md) — owns the *ambiguous* repetition cases
  (separated lists, operator trees) that no structural fold can name.
- [BNF rule visitor](./rule-visitor.md) — `isRepeat` in `bnf/data` is the single
  discriminator the visitor should absorb.
