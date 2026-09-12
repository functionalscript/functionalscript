## A shared empty array has no vector, because the carrier cannot spell one

**Priority:** P2 — one graph shape no consumer of the corpus can be tested on.
Nothing is wrong with any vector that exists, and this repository's own writer is
covered, which is why it is not P1.
**Status:** open — the limitation is measured and stated below; the fix is a
carrier or schema change and needs a decision first.

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
spellings that denote it and the two that do not. The writer side is the same
trick in the `normalize` set's proof, which pins `tryStringify`'s output for a
shared empty array — that set lands in the step after this one, so read the
claim as covering the reader today and the writer when it arrives.

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

- [ ] **Look for a spelling in the subset**, and record the result either way —
      a negative result is what makes the other two routes worth their cost.
- [ ] **Decide between the schema change and the stated limitation**, which is
      the owner's: the first buys every shape and costs every record type.
- [ ] If the limitation stands, **say it in
      [`../README.md`](../README.md)** beside the sharing rule, so a harness
      author reads it with the schema rather than finding it here.

### Related

- [`../README.md`](../README.md) — the corpus schema; sharing is part of a graph
  is stated there, and this is the one shape it cannot carry.
- [`../../todo/conformance-vectors.md`](../../todo/conformance-vectors.md) — the
  design this corpus came from; it records the `TS7034` measurement and the two
  proofs that work around it.
- [`fjs/media/datajs/todo/serializer.md`](../../../../fjs/media/datajs/todo/serializer.md)
  — stage 4's corpus proofs, which serialize the inputs these sets export and so
  are what a shared empty array would reach.
