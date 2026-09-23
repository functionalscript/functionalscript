## Rebuild tuples inside the subset

**Priority:** P2 — shipped `.f.mjs` code is written outside the subset. No
caller sees a wrong answer today, which is why it is not P1.
**Status:** blocked
**Blocked by:** the first task of
[new-array-out-of-subset](../../../../todo/new-array-out-of-subset.md), the
exception in writing. Nothing below is implemented until that ruling is
taken; what this issue adds is the case for taking it one way.

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
nothing here depends on that proposal's fate, since the argument below rests
on the readers' domain and not on any pattern.

**What the code is for is an input the readers do not take.** The only thing
`tupleRebuild` does that the subset-legal `arrayRebuild` beside it does not is
keep an *interior* hole: a declared member absent with a present one after it.
Presence is decided in `constContainerParse` by `k in value`, and for a dense
array that is true at every index below `length` and false at every index at
or above it. So on a dense input an absent declared member is only ever part
of a trailing run, `entries` never has a gap, and `arrayRebuild` builds the
same value. An interior gap needs a hole in the input. The
[rtti README](../../README.md#what-the-readers-assume-of-a-value) says the
readers are written for DataJS values, the values FunctionalScript itself can
build, and
[`structurally_same`](../../../types/object/structurally_same/README.md) says
outright that FunctionalScript cannot build a sparse array. The branch that
puts the function outside the subset exists for a value outside the readers'
stated domain.

Two texts are already out of step with the code and go with the fix:

- The rtti README's reader table says an absent optional member is "present
  as `undefined`" in `parse`'s result. The code leaves it absent: a trailing
  run shortens the array and a struct drops the key, as `absentPositions` in
  [`proof.f.mjs`](../proof.f.mjs) pins.
- `largeSparse` in the same proof builds its input from `new Array(1)` and
  calls it "a sparse value FunctionalScript can build without mutation",
  which contradicts `structurally_same` and is the `fjs/rtti/parse/proof.f.mjs`
  row in the umbrella's table.

### Proposal

The umbrella's first task asks whether the subset admits a fresh,
never-escaped array built with `new Array(n)` and written by index. Its last
task, the `fjs/rtti/parse` hole producer, prescribes one edit if the
exception is granted, citing the new rule from the JSDoc, and the opposite
if it is refused, and names this issue as that task's owner. This issue is
the case for refusing it here, and everything below is that arm: the branch
the exception would legalize serves no input the readers take, so there is
nothing for an exception to keep. If the ruling nevertheless grants it, the
umbrella's other arm applies and this issue closes without the edit below.

Under a refusal: replace `tupleRebuild` with `arrayRebuild` for the tuple
kinds, delete it, and **refuse an interior gap** where the container loop
already refuses the other hole. That second half is not optional.
`arrayRebuild` over the entries of `[, 3]` against `[or(option, number),
3]` is `[3]`: every position after the gap shifts down by one, and the
reader has answered a value outside its domain with a plausible wrong one,
which is the single outcome
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
never allows. Declaring the readers' domain to be DataJS does not change
that: a value that violates the contract is refused at the boundary or
asserted against inside it, never answered.

The refusal has a precedent in the same file. `holePastThePrefixRejected`
in [`proof.f.mjs`](../proof.f.mjs) pins that `parse([number])([1, ,])` is
an error: a hole past the declared prefix is already refused, as a
`ValidationError` like any other rejected input, and proven with an elision
literal. An interior hole gets the same answer and the same kind of proof.
The check needs nothing the rebuild does not already hold: `entries` is in
reverse member order with the last present index at its head, so the
entries are gap-free exactly when that index plus one is their count.
Where the check sits, in the tuple's `_Rebuild` returning a result or in
the container loop as an absent member followed by a present one, is the
implementer's call; the answer is `verror('unexpected value')` either way.

That refusal branch is reachable only by a value the subset cannot build,
and its proof is an elision literal in a `.f.mjs`. The umbrella's sweep
tolerates exactly that for a guard that survives: "leave the code, rewrite
the prose to say which caller it defends against", and
`holePastThePrefixRejected` is one such guard today. This is a different
question from
[fjs/AGENTS.md §1.6](../../../AGENTS.md#16-do-not-prove-a-fmjs-api-from-plain-javascript),
which keeps host-built values out of a `proof.mjs`; the earlier draft of
this issue conflated the two and dismissed the refusal on that ground,
which was wrong.

Of the three proofs whose subject is hole preservation,
`interiorHoleSurvives` and `oddSegments` become refusal proofs of the same
inputs, beside `holePastThePrefixRejected`, so the branch that replaces
preservation is covered by the inputs that used to exercise it.
`largeSparse` tested the segment join at scale; the join goes, and the
proof goes with it, taking the file's `new Array` along.
`trailingRunShortens` and `structDropsTheKey` describe absence on dense
input and stay as they are.

### Tasks

- [x] Confirm the premise empirically before anything else: with
  `arrayRebuild` substituted for `tupleRebuild`, every entry of
  [`proof.f.mjs`](../proof.f.mjs) still passes except the three named above.
  A fourth failure means an interior gap has a dense source and the
  proposal is wrong. Done at `c105badf` in
  [review](https://github.com/functionalscript/functionalscript/pull/2214#pullrequestreview-5295696136):
  substituted at both call sites, `tupleParse` and `restTupleParse`, the
  suite fails exactly `interiorHoleSurvives`, `oddSegments` and
  `largeSparse`, and `trailingRunShortens` and `structDropsTheKey` stay
  green. Redo it on the commit that makes the change.
- [ ] Once the exception is refused in writing: make the substitution,
  delete `tupleRebuild`, add the interior-gap refusal, turn
  `interiorHoleSurvives` and `oddSegments` into refusal proofs beside
  `holePastThePrefixRejected`, delete `largeSparse`, and rewrite the tuple
  rebuild's JSDoc to say
  what remains true: members in order, a trailing absent run shortens the
  result, an interior hole is refused as a hole past the prefix is.
- [ ] Correct the rtti README's reader table, and say in the same section
  that `parse` output is dense.
- [ ] Note in `structurally_same`'s README that `parse` output is one more
  dense source, or leave it silent if the README's general claim already
  covers it; the umbrella's opposite note, for the case the exception was
  granted, is not needed.
- [ ] Tick the umbrella's `fjs/rtti/parse` task, which this issue now owns.
- [ ] `npm run cov` at 100% before and after; a drop means the refusal
  branch is not the one the converted proofs reach, or a branch
  `largeSparse` covered is still there.

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
  DataJS premise the proposal rests on.
- [`structurally_same`](../../../types/object/structurally_same/README.md) —
  the dense premise on the other side of `parse`'s output.
