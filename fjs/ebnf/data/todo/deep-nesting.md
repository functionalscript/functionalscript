## Lower a deeply nested or widely colliding rule without overflowing the stack

**Priority:** P3
**Status:** open

### Problem

`toData` recurses once per nesting level of the rule it lowers, several JS
frames deep — `lower`, `lowerData`, `lowerBody`, `lowerSequence`, the
`reduce` step, `lower` again — so a rule nested deeply enough overflows the
call stack. Measured on Node 22:

```js
const nest = n => Array.from({ length: n }).reduce(r => [r], 'x')
toData(nest(831))   // lowers
toData(nest(880))   // RangeError: Maximum call stack size exceeded
```

`Rule` documents no nesting limit, so a machine-generated grammar can meet
this. The classical `bnf/data` lowering is recursive too and overflows
around depth 2000; this one pays about twice the frames per level.

A second recursion is as deep as the names that collide: `freshFrom`
retries the next counter suffix from within the frame that tried the last,
so thousands of thunks sharing one `.name` overflow it too, on a flat rule:

```js
toData(Array.from({ length: 5000 }, (_, i) => ({ a: () => ['const', i] }).a))
// RangeError: Maximum call stack size exceeded
```

A hand-written grammar is nowhere near either — the deepest rule in
[`../../lib/json`](../../lib/json/module.f.mjs) nests about fifteen levels
— which is why this is an issue rather than a blocker: the crash is loud, a
`RangeError` and never a plausible wrong grammar, and
[AGENTS.md §5](../../../../AGENTS.md#5-pull-requests-and-releases) lets a
crash wait behind an issue naming the input that breaks it.

### Proposal

Lower with an explicit work stack over the immutable `_State`, the shape
`fjs/bnf/ll1`'s matcher uses for the same reason: a frame per rule being
lowered holding the children still to lower and the names lowered so far,
so the JS stack stays O(1) however deep the rule. `freshFrom` takes the
same treatment, a loop over the counter, or a per-hint counter kept in the
state so a fresh name is one lookup rather than a search past every name
taken. `emptyTagMap`'s fixpoint already iterates rather than recurses,
since a chain of rules each naming the next takes as many rounds as it has
rules; what it still pays is a full round per fact, quadratic on such a
chain, a cost rather than a crash.

### Tasks

- [ ] Rewrite `lower` and its helpers over an explicit stack; keep every
      existing proof passing unchanged, since the output is the same.
- [ ] Prove a rule nested past the old threshold — `nest(10000)` — lowers,
      and that a rule that names itself still lowers under the new walk.
- [ ] Prove ten thousand thunks sharing one name lower, each under its own
      counter suffix.
- [ ] `tsc`, `fjs test`, 100% coverage.

### Related

- [`../module.f.mjs`](../module.f.mjs) — `lower` and the helpers it
  recurses through.
- `fjs/bnf/ll1/module.f.mjs` — the explicit-stack matcher, the shape to
  follow; named rather than linked, since `ebnf/` never links into `bnf/`.
