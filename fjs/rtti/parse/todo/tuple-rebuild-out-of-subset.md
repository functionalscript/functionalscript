## `tupleRebuild` is not FunctionalScript

**Priority:** P2 — shipped `.f.mjs` code is written outside the subset. No
caller sees a wrong answer today, which is why it is not P1.
**Status:** blocked
**Blocked by:** the first task of
[new-array-out-of-subset](../../../../todo/new-array-out-of-subset.md), the
exception in writing. Which fix applies depends on that ruling. This issue
records the bug and what is known about it; the ideas below are directions a
fix could take, and none of them is decided.

### Problem

`tupleRebuild` in [`module.f.mjs`](../module.f.mjs) is not FunctionalScript.
It allocates with `new Array(n)`, which no `Array` table admits
([built-in](../../../../spec/todo/2360-built-in.md) lists `from`, `fromAsync`,
`isArray` and `of` and no constructor); it writes every member with
`Object.defineProperty` in a loop, which the same document lists as `mutate`;
and what those two produce is a sparse array, which the
[specification](../../../../spec/README.md) says no array literal can spell.
Its JSDoc concedes all of this and claims an exception by local freshness, that
the array is the function's own and is returned before anything else sees it.
No document grants that exception.
[new-array-out-of-subset](../../../../todo/new-array-out-of-subset.md) records
it as the one shipped `new Array` in the tree. The function length pattern
proposed in
[#2213](https://github.com/functionalscript/functionalscript/pull/2213),
which would admit one construction-time `defineProperty` as a complete
matched pattern, says in as many words that it does not cover this one;
nothing here depends on that proposal's fate.

Two texts are already out of step with the code and go with whatever fix is
chosen:

- The rtti README's reader table says an absent optional member is "present
  as `undefined`" in `parse`'s result. The code leaves it absent: a trailing
  run shortens the array and a struct drops the key, as `absentPositions` in
  [`proof.f.mjs`](../proof.f.mjs) pins.
- `largeSparse` in the same proof builds its input from `new Array(1)` and
  calls it "a sparse value FunctionalScript can build without mutation",
  which contradicts `structurally_same` and is the `fjs/rtti/parse/proof.f.mjs`
  row in the umbrella's table.

### What is known

**The out-of-subset branch serves one input: an interior hole.** The only
thing `tupleRebuild` does that the subset-legal `arrayRebuild` beside it does
not is keep a declared member absent with a present one after it. Presence
is decided in `constContainerParse` by `k in value`, and for a dense array
that is true at every index below `length` and false at every index at or
above it. So on a dense input an absent declared member is only ever part of
a trailing run, `entries` never has a gap, and `arrayRebuild` builds the
same value. An interior gap needs a hole in the input.

That was checked rather than argued, at `c105badf` and again at `ad8d6fcf`
in [review](https://github.com/functionalscript/functionalscript/pull/2214#pullrequestreview-5295696136):
with `arrayRebuild` substituted at both call sites, `tupleParse` and
`restTupleParse`, the suite fails exactly `interiorHoleSurvives`,
`oddSegments` and `largeSparse`, the three proofs whose subject is hole
preservation, and no fourth. `trailingRunShortens` and `structDropsTheKey`
stay green.

**A hole is outside the readers' stated domain.** The
[rtti README](../../README.md#what-the-readers-assume-of-a-value) says the
readers are written for DataJS values, the values FunctionalScript itself can
build, and
[`structurally_same`](../../../types/object/structurally_same/README.md) says
outright that FunctionalScript cannot build a sparse array.

**A hole is already refused in one position.** `holePastThePrefixRejected`
in [`proof.f.mjs`](../proof.f.mjs) pins `parse([number])([1, ,])` as an
error, proven with an elision literal; that is the precedent for both a
refusal of a hole and its proof.

**Replacing the rebuild alone would be a silent wrong answer.**
`arrayRebuild` over the entries of `[, 3]` against `[or(option, number), 3]`
is `[3]`: every position after the gap shifts down. Whatever the fix, a
sparse input either keeps its meaning or is refused; a shifted array is the
outcome [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
never allows.

### Ideas

Directions a fix could take, in no order and none chosen. Each is subject to
the umbrella's ruling and, for the last, to the language-design gate in
[DESIGN.md §12](../../../../doc/DESIGN.md#12-preserve-harmless-javascript-conventions).

- **Grant the freshness exception**, in `spec/README.md` and
  `fjs/AGENTS.md` §3.1, as the umbrella's `fjs/rtti/parse` task describes
  for that arm: the code stays, its JSDoc cites the rule, and
  `structurally_same`'s README notes `parse` output as the one source of
  sparse arrays its dense premise does not cover. This admits holes as
  something FunctionalScript code can build, which the specification
  currently denies.
- **Rebuild dense and refuse an interior gap.** `arrayRebuild` for both
  tuple kinds, plus a refusal where the container loop already refuses a
  hole past the prefix. The check needs only what the rebuild holds: the
  last present index is at the head of the reversed entries, and the
  entries are gap-free exactly when that index plus one is their count.
  `interiorHoleSurvives` and `oddSegments` would become refusal proofs
  beside `holePastThePrefixRejected`; `largeSparse` would go with the
  segment join it tests. The refusal branch is reachable only by a value the
  subset cannot build, and its proof is an elision literal in a `.f.mjs`,
  which the umbrella's sweep tolerates for a guard that survives.
- **Rebuild dense and leave holes to the boundary.** `arrayRebuild` alone,
  with the DataJS domain as the contract and no guard, on the argument that
  a value is validated where it enters from IO and trusted from then on.
  This is the cheapest, and the finding above rules it out unless something
  upstream of `parse` already refuses every sparse value.
- **Keep hole preservation through an admitted pattern**, if the language
  ever admits a construction-time idiom for arrays the way #2213 proposes
  one for a function's `length`. Nothing proposes that today, and it would
  reopen the question the first idea answers.

### Tasks

- [ ] Take the umbrella's ruling on the exception, then choose among the
  ideas above or something better; record the choice here before
  implementing it.
- [ ] Implement the chosen fix with its proofs, and rewrite the tuple
  rebuild's JSDoc to say what is then true.
- [ ] Correct the rtti README's reader table, and say in the same section
  what `parse` does with an absent member and with a hole.
- [ ] Correct or delete `largeSparse`'s claim that FunctionalScript can build
  a sparse value.
- [ ] Tick the umbrella's `fjs/rtti/parse` task, which this issue now owns.
- [ ] `npm run cov` at 100% before and after.

### Related

- [new-array-out-of-subset](../../../../todo/new-array-out-of-subset.md) —
  the sweep this is one step of, and the survey that found the site.
- [Function length pattern](https://github.com/functionalscript/functionalscript/pull/2213)
  — `spec/todo/3130-function-length-pattern.md` once it lands: the one
  construction-time `defineProperty` the language may admit; this function
  is not it.
- [Built-in](../../../../spec/todo/2360-built-in.md) — `Array` as a namespace
  and `defineProperty` as `mutate`.
- [rtti README](../../README.md#what-the-readers-assume-of-a-value) — the
  DataJS premise.
- [`structurally_same`](../../../types/object/structurally_same/README.md) —
  the dense premise on the other side of `parse`'s output.
