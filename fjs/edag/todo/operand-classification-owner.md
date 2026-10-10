## Eager and lazy operands are classified in three modules, and they disagree

**Priority:** P3
**Status:** open

### Problem

Which operands a node establishes unconditionally, and which only when it
decides to, is a property of the EDAG. It is written three times, by three
consumers, over three representations:

- [`fjs/compiler/serializer`](../../compiler/serializer/module.f.mjs)
  keeps private `operands`, `lazyOperands`, `allOperands`,
  `eagerOperands`, `eagerFrom`, `reachableThrough`, `reachableFrom`,
  `referencesWithin` and `sharedWithin` — all over
  [`analysis`](../analysis/module.f.mjs)'s `Node`, the representation that
  module owns, beside the `operandsOf`, `stepOperands` and `itemOperand` it
  already imports from there. `sharedWithin` restates the analysis's own
  `shared` rule over a subgraph.
- [`edag/rust`](../rust/module.f.mjs) keeps `eagerOperandsOf`,
  `lazyOperandsOf`, `chainLazy` and a `stepOperands` of its own, over the
  linked `Exp`.
- [`fjs/compiler/ast`](../../compiler/ast/module.f.mjs) keeps `chainEager`,
  `chainOperands` and a third `stepOperands`, over the AST.

The three do not agree. For a `.` node whose continuation is a plain call
step, `|()`, `edag/rust`'s `chainLazy` and `compiler/ast`'s `chainOperands`
list the call's arguments as lazy — "after an access that may throw with
them untouched". The serializer's `operands` lists them as eager and its
`lazyOperands` reserves the lazy region for `|?.()` alone. The serializer
hoists a `const` only from what `eagerFrom` reaches, so it may hoist from
those arguments where the other two would not. Whether that is a defect or
a deliberate difference is not written down anywhere, which is the
drift [DESIGN.md §4](../../../doc/DESIGN.md#4-reuse-dry-and-separation-of-concerns)
describes: a rule with three owners has no owner.

### Proposal

`analysis` owns the classification over `Node`: it exports eager and lazy
operand lists, a parameterized reach (through every operand, or through
eager ones only), and `places` over a chosen root, so that the serializer's
private walks become imports. The `.`/`|()` question is settled first, in
the analysis's JSDoc, and the AST and `Exp` copies are checked against it —
[identity-shared-walks](./identity-shared-walks.md) decides whether the
`Exp` walk can share more than the rule.

### Tasks

- [ ] Settle whether a plain call step after `.` is eager or lazy, and
      write the answer where the three copies can cite it.
- [ ] Export the classification and reaches from `analysis`; move the
      serializer's private walks onto them, output unchanged.
- [ ] Align `compiler/ast` and `edag/rust` with the settled rule, or
      document at each why its representation differs.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%; regenerate and diff the
      compiled corpus.

### Related

- [identity-shared-walks](./identity-shared-walks.md) — traversal sharing
  between `analysis` and `edag/rust`; this issue is the rule the traversals
  apply, not the traversal.
- [analysis](./analysis.md) — the sharing contract `sharedWithin` restates.
