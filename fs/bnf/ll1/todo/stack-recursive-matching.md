## stack-recursive-matching. LL(1) matcher recurses once per grammar step, overflowing on long input

**Priority:** P3
**Status:** open

### Problem

`fs/bnf/ll1/module.f.ts`'s matcher `f` (inside `parserRuleSet`) recurses
natively: after consuming a code point it walks the dispatched `rules` chain
with one nested `f` call per rule. For a right-recursive rule — which is how
`repeat0Plus` encodes repetition — every additional repetition adds another
JS call-stack frame, so match depth grows with *input length*, not grammar
size. Deeply nested input (e.g. thousands of bracket levels) hits the same
limit through the same mechanism.

Confirmed repro: `parser(repeat0Plus(set(' \t')))` matching 10,000 spaces
throws `RangeError: Maximum call stack size exceeded` (5,000 still passes —
the threshold is higher than the descent backend's old ~2,000–3,000 because
LL(1)'s per-repetition frame chain is shallower, but the failure mode is
identical).

This is the same bug that was fixed in the sibling descent backend in PR
[#1303](https://github.com/functionalscript/functionalscript/pull/1303) (see
its CHANGELOG entry for the history): `fs/bnf/descent/module.f.ts`'s matcher
now runs as an explicit-stack machine and handles 100 KB+ inputs; the LL(1)
matcher was not touched. Today nothing outside `fs/bnf/ll1`'s own proofs consumes this
parser (hence P3, not P1), but any future consumer with realistic input
sizes will hit it.

### Proposal

Port the descent backend's fix: rewrite `f` as an explicit-stack machine.
`fs/bnf/descent/module.f.ts` is the template — its matcher keeps two
suspended-frame kinds on an immutable cons-cell stack and loops, either
starting the current rule invocation or feeding the pending result into the
innermost frame. The LL(1) version is simpler: `f` has only one recursion
site (the `rules`-chain loop), so a single frame kind suffices — roughly
`{ tag, rules, ruleIndex, seq }` plus the pending remainder.

While rewriting, also fix the quadratic input handling in the same function:
`const [, ...restCp] = cp` copies the entire remaining input on **every**
consumed code point (O(n²) time/allocation overall). The descent backend
threads an index `idx` into a shared immutable array instead; `Remainder`
being part of the public `MatchResult` type means the index can be converted
back to a slice once at the end (or the result type generalized), rather
than per step.

Note `dispatchMap`'s build-time recursion (`dispatchRule`) is bounded by
grammar size, not input size — it does not need to change.

### Tasks

- [ ] Rewrite `f` in `parserRuleSet` as an explicit-stack loop (single frame
      kind: dispatched rules chain + accumulated sequence + tag).
- [ ] Replace per-step rest-spread with an index into the input array;
      materialize the `Remainder` slice only at the boundary.
- [ ] Add a `longInput` proof group mirroring
      `fs/bnf/descent/proof.f.ts` — long `repeat0Plus` repetition (10,000+
      code points) and deep bracket nesting via `deterministic()`.
- [ ] `npx tsc`, `node ./fs/module.ts t`.

### Related

- `fs/bnf/descent/module.f.ts` — the ported fix to mirror (explicit frame
  stack; see the `longInput` proof group in its `proof.f.ts`), landed in PR
  [#1303](https://github.com/functionalscript/functionalscript/pull/1303),
  whose CHANGELOG entry records the history of the same bug in the descent
  backend and why the fix belongs in the matcher, not the grammar.
- [../../todo/667-bnf-repeat-flatten.md](../../todo/667-bnf-repeat-flatten.md)
  — the `repeat` data-node proposal; would reduce repetition depth for
  detected shapes but is not a complete fix (deep nesting, undetected
  right-recursive shapes), and is tracked for data-shape reasons.
