## `fjs/edag/analysis`'s walk recurses through a deeply nested EDAG

**Priority:** P2
**Status:** open

### Problem

`dispatch`/`visit` (or their equivalent in whatever the current analysis
walk is named) recurse once per operand, so a sufficiently deep EDAG —
a long left-associative operator chain (`1 + 1 + 1 + …`), or deeply
nested containers (`[[[[…]]]]`) — overflows the JS call stack:

```sh
$ fjs compile in.f.js out.rs   # in.f.js: an 8,000-term `1 + 1 + … + 1`
file:///…/fjs/edag/analysis/module.f.mjs:137
    const known = state.visited.get(e)
                                ^
RangeError: Maximum call stack size exceeded
```

This is not new: the same crash reproduces for deeply nested array
literals with no operator involved at all, at a similar depth, so it
predates [operators](../../fsc/todo/../../../spec/todo/2340-operators.md)
Stage A — Stage A only made a source shape (a long operator chain) that
reaches it far more easily to write than the pre-existing ones
(nested containers, access chains) were.

Two shallower, narrower versions of the same shape were already fixed
directly in `fjs/fsc/ast/module.f.mjs` (`refsOf`'s operator/negation/
bitwise-not walk) and `fjs/fsc/edag/module.f.mjs` (`lower`'s own),
each with an explicit heap-allocated stack in place of recursion,
matching how `evaluate` in `fjs/fsc/parser/module.f.mjs` already
resolves a value's own operators. This issue is the same fix, one
layer further down, in code shared by every EDAG consumer rather than
one compiler stage — a bigger, more central rewrite, out of Stage A's
own scope.

### Proposal

The same shape again: convert the walk to an explicit stack (or adopt
whatever general trampolining mechanism `fjs/types/list`'s own
`List`/`trampoline` already gives the rest of the repository) so a
node however deep costs heap frames, not call-stack ones. Since this
module is shared by every consumer of an EDAG — the FunctionalScript
writer, the Rust writer, the operator-conformance corpus, `fjs/edag/
memo` — fixing it here is worth more than fixing each caller
separately, and the two narrower fixes already landed (`refsOf`,
`lower`) are natural precedents for the technique, not a substitute
for it.

### Tasks

- [ ] Identify every recursive call in `fjs/edag/analysis/module.f.mjs`
      (and any sibling module with the same shape) whose depth is the
      *input's*, not a bounded constant.
- [ ] Convert to an explicit stack, preserving walk order (the
      module's own numbering/scope assignment currently depends on
      visiting each node once, on the first edge that reaches it —
      any rewrite has to preserve that, not just avoid crashing).
- [ ] Proof coverage at a depth the existing `stackSafety` proofs
      elsewhere in the repository use (`fjs/fsc/parser/proof.f.mjs`'s
      is 5,000) for a chain of operators, nested containers, and
      whatever other shape reaches this walk.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`./analysis.md`](./analysis.md) — the analysis this walk implements;
  this issue is about its recursion depth, not its design.
- [`../../fsc/ast/module.f.mjs`](../../fsc/ast/module.f.mjs) — `refsOf`'s
  own explicit-stack fix, the narrower precedent.
- [`../../fsc/edag/module.f.mjs`](../../fsc/edag/module.f.mjs) — `lower`'s,
  the other one.
- [`../../fsc/parser/module.f.mjs`](../../fsc/parser/module.f.mjs) —
  `evaluate`, whose `_Stack` is the same shape again, for the same reason.
