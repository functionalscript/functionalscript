## Eager and lazy operand classifiers disagree

**Priority:** P3
**Status:** open

### Problem

Which operands a node establishes unconditionally, and which only when it
decides to, is a property of the EDAG. Consumers classify their own
representations independently:

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
  `chainOperands` and its own `stepOperands`, over the AST.

The evaluation order is already established by
[`edag/operations`](../operations/module.f.mjs)'s `operation`: its
`property` helper reads the property, then demands the call's arguments
inside `then`, which propagates a failed read without demanding them.
For a `.` node whose continuation is a plain call step, `|()`, the receiver
and key are eager; the call's arguments are lazy because the access may
throw with them untouched. A successful read still demands the arguments
before checking whether its value is callable.

`edag/rust`'s `chainLazy` / `eagerOperandsOf` and `compiler/ast`'s
`chainOperands` / `chainEager` follow that order. The serializer is the
divergent copy: its `operands` lists the plain call's arguments as eager
and its `lazyOperands` reserves the lazy region for `|?.()` alone. Since
`eagerFrom` controls which scope owns a `const`, this can establish an
argument before the access that should precede it. For example, a shared
constructor under one argument makes that difference observable:

```js
const x = ['[]', [['throw', 'argument']]]
const argument = ['[]', [x, x]]
const root = ['.', null, 'f', ['|()', [argument]]]
```

The null receiver must fail at the property read with `argument` untouched;
hoisting `x` before the access throws `'argument'` instead. This is a
serializer ordering defect, not an unresolved language decision. It is the
drift [DESIGN.md §4](../../../doc/DESIGN.md#4-reuse-dry-and-separation-of-concerns)
describes: a rule with several owners has no owner.

### Proposal

`analysis` owns the classification over `Node`: it exports eager and lazy
operand lists, a parameterized reach (through every operand, or through
eager ones only), and `places` over a chosen root, so that the serializer's
private walks become imports. Its JSDoc records the established
read-before-arguments rule and cites `operations`; the AST and `Exp` copies
cite the same rule. Moving the serializer onto it corrects its eager
treatment of `.` / `|()` arguments. Serializer output may change wherever
needed to preserve that evaluation order and keep argument-only bindings
inside the argument that establishes them. Preserve sharing when the
argument is demanded, as well as skipping it when the read fails.
[identity-shared-walks](./identity-shared-walks.md) decides whether the
`Exp` walk can share more than the rule.

### Tasks

- [ ] Record the read-before-arguments rule in `analysis`'s JSDoc and
      reference it from the AST and `Exp` classifiers.
- [ ] Export the classification and reaches from `analysis`; move the
      serializer's private walks onto them, correcting its `.` / `|()`
      classification and any resulting output expectations.
- [ ] Prove that a plain access's receiver and key remain eager while its
      plain call arguments are lazy; cover guarded calls and continuation
      operands too, against `compiler/ast` and `edag/rust`'s classifiers.
- [ ] Extend `operations`'s operand-demand proof for a null receiver with
      a throwing `|()` argument: only receiver and key are demanded.
      Also prove that a successful read of a non-callable value demands
      that argument and propagates its failure before the call fails.
- [ ] Add a serializer regression for the shared throwing constructor
      above, checking emitted text and evaluation after parsing it: the
      access fails before the argument runs. Add a successful-access case
      with a nonthrowing shared constructor to prove it is still one value
      when demanded, and retain receiver-sensitive method-call behavior.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%; regenerate and diff the
      compiled corpus, explaining output changes that correct evaluation
      order.

### Related

- [identity-shared-walks](./identity-shared-walks.md) — traversal sharing
  between `analysis` and `edag/rust`; this issue is the rule the traversals
  apply, not the traversal.
- [analysis](./analysis.md) — the sharing contract `sharedWithin` restates.
