## A shared empty array has no vector, because the carrier cannot spell one

**Priority:** P2 — one graph shape no consumer of the corpus can be tested on.
Nothing is wrong with any vector that exists, and this repository's own writer is
covered, which is why it is not P1.
**Status:** decided — **the stated limitation stands.** The schema change below
was weighed and refused: it is not worth every record type and every proof for
one shape, and it would give up the property that a set is an ordinary graph
`tsc` checks. Nothing here is waiting on anyone.

Kept as the record rather than deleted, because
[`../README.md`](../README.md) cites it twice for what no surviving file says —
beside the sharing rule, and in §What this corpus cannot establish — and what it
cites is the search for a spelling that came back negative, the alternative that
was refused and why, and the two proofs that cover this repository where the
corpus cannot. The design issue that derived the corpus cited it too and has been
deleted; the measurement it recorded is in §Problem below, so nothing was lost
with it. A reader who notices that a shared empty array has no vector in any role
would otherwise be left to re-derive the whole thing.

### Problem

Sharing is part of a graph: `[$a, $a]` with one `const` is one node reached
twice, and `[[], []]` is two nodes. Every set expresses it the only way a
JavaScript value can, by reference identity — a `const` binds the node and two
places name it.

**That route is closed for the empty array.** A set is a data module in the
DataJS subset, which has no annotations, and `const $e = [];` there is `TS7034`:
`tsc` types it as an evolving `any[]` and reports `TS7005` at every read. So no
set can bind an empty array and share it, and the graph `[e, e]` with `e = []`
has no vector in any role.

**What that leaves untested, and for whom.** A writer that emits an empty
container inline wherever it appears — a plausible optimisation, since `[]` is
shorter than a reference — turns one shared empty array into two distinct ones.
It emits a valid document denoting a *different graph*, which is the exact defect
`graph-equivalence` exists to catch, and it passes every vector in the corpus.

The direction matters and is not covered by the empty inverse vectors:
`graph-unshared-array-empty` rules out *merging* two distinct empties into one
node, where this is *expanding* one shared empty into two.

**This repository covers itself, and only itself.** A proof may carry an
annotation where a data module may not, so `sharedEmptyArray` in
[`../graph-equivalence/proof.f.mjs`](../graph-equivalence/proof.f.mjs) builds
the graph and checks it against four documents through the reader: the two
spellings that denote it and the two that do not — and, since the writer-side
runs landed, hands the same graph to `tryStringify` and requires the output to
denote it, which the two ruled-out documents are exactly what an inlining writer
would emit instead. The byte-exact side is the same trick in
[`../normalize/proof.f.mjs`](../normalize/proof.f.mjs), whose `sharedEmptyArray`
asserts `tryStringify` gives
`const $0=[];const $1=[$0];export default [$1,$1,$0];`. Both roles are covered
here, which is what the Status block above says.

A third-party harness gets neither, because it reads the sets.

The empty **object** has none of this trouble: `const $o = {};` types as `{}`
and several vectors share one.

### Proposal

Three routes, and the first is the one to rule out first.

- **Spell it in the subset.** Nothing found: an array literal is the only way to
  build an array in DataJS, `[]` bound to a `const` is the case above, and the
  subset has no calls, no annotations and no comments. If a spelling exists this
  issue is a two-line fix, so look before building anything.
- **Say it in the schema instead of by identity.** A record could carry sharing
  as data — a path pair saying two positions are one node — which every role
  could then express for any value, empty array included. That is a change to
  every record type and every proof that reads one, and it gives up the property
  that a set is an ordinary graph a `tsc` type checks. It answers more than this
  one shape, which is the argument for it.
- **Leave it to each implementation's own proof, and say so.** What happens
  today, minus the saying: the corpus states the limitation where a consumer
  reads it, and an implementation that wants the coverage writes the case its
  own language can spell. Cheapest, and honest, but it means one graph shape the
  corpus describes and cannot test.

### Tasks

- [x] **Look for a spelling in the subset**, and record the result either way —
      a negative result is what makes the other two routes worth their cost.
      Done, negative: the search and its result are the first route above.
- [x] **Decide between the schema change and the stated limitation**, which is
      the owner's: the first buys every shape and costs every record type.
      Decided: **the stated limitation stands.** The schema change is not worth
      every record type and every proof for one shape, and it would give up the
      property that a set is an ordinary graph `tsc` checks. So the corpus says
      what it cannot carry, the two proofs pin the shape for this repository's
      own reader and writer, and an implementation that wants the coverage in a
      language that can spell it writes the case itself.
- [x] If the limitation stands, **say it in
      [`../README.md`](../README.md)** beside the sharing rule, so a harness
      author reads it with the schema rather than finding it here. Done: the
      schema states it and links here, which holds whichever way the decision
      below goes — the schema route would replace the sentence rather than
      leave the corpus silent.

### Related

- [`../README.md`](../README.md) — the corpus schema; sharing is part of a graph
  is stated there, and this is the one shape it cannot carry.
- [`fjs/media/datajs/todo/serializer.md`](../../../../fjs/media/datajs/todo/serializer.md)
  — stage 4's corpus proofs, which serialize the inputs these sets export and so
  are what a shared empty array would reach.
