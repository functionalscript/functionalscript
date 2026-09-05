## ll1-machine-skeleton. The LL(1) stack machine is written twice inside `bnf/ll1`

**Priority:** P5
**Status:** open

### Problem

`fjs/bnf/ll1/module.f.mjs` contains two hand-rolled explicit-stack LL(1)
machines in one file:

- `parserRuleSet`'s matcher (~`:194-321`): `_Stack`/`_Task` loop, the
  four-arm data-rule dispatch, the sequence/repeat resume;
- `transformers(...).build(...).match` (~`:420-633`): the same loop with
  the frame kinds re-declared inline (`_TransformSequenceFrame` etc.), the
  same dispatch, the same resume.

They differ in what a completed node *becomes* (an `Ast` node vs a
transformer's `Out<M, T>`) and in the result shape; the machine itself —
including subtle lines like the repeat-continuation predicate, which is
character-identical at `:234` and `:487` —

```js
if (pos <= cp.length && dispatchOp.get(dispatched(item).rangeMap)(symbolAtCp(cp, pos)) !== null)
```

— is duplicated. A change to the LL(1) semantics (cursor/EOF handling, the
input-ran-out arm, the repeat-termination argument) must land twice, and a
divergence is a parser/transformer disagreement no type checks.

### Prior decisions this does not reopen

- [207-bnf-semantic-actions.md](./207-bnf-semantic-actions.md) decided
  "`parserRuleSet` keeps its native path. It is not this machine with an
  empty map: the machine needs a `Monoid<M>` the AST API has no use for."
  That rules out *implementing one entry point as the other*. It does not
  address whether the two machines can share their skeleton with the
  node-completion step as the parameter — a factoring in which neither path
  conjures a monoid.
- `fjs/bnf/matcher`'s header states that "frame shapes … are each
  backend's own, and deliberately different" — about `ll1` vs `descent`.
  This issue is *within* `ll1`: one backend, one frame vocabulary, spelled
  twice.

### Proposal

Investigate a shared skeleton private to `ll1`, parameterized over the
completion step (roughly: `leaf`, `node(tag, children)`, and the
repeat-fold hook the transformer path threads), with `parserRuleSet` and
`build(...).match` as its two instantiations. If the parameterization costs
more indirection than the ~110 duplicated lines are worth — a real
possibility given the per-frame payload differences — record the outcome
here (or in a comment tying the two `:234`/`:487` twins together) and
close as won't-fix; today nothing marks the two copies as needing lockstep
edits, which is the cheapest fix of all.

### Tasks

- [ ] Prototype the shared skeleton; measure the indirection cost against
      the duplication.
- [ ] Land it, or record the won't-fix rationale and cross-mark the twin
      sites.
- [ ] `tsc`, `fjs t`; `descentEquivalence` and the transformer proofs pin
      both paths.

### Related

- [207-bnf-semantic-actions.md](./207-bnf-semantic-actions.md) — the
  decision constraining, but not foreclosing, this factoring; see above.
