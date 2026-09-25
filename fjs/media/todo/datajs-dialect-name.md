## Reconcile `vnd.fjs.djs` with the DataJS dialect

**Priority:** P4
**Status:** open

### Problem

The dialect names for FunctionalScript's JavaScript subsets were settled in
two places that no longer agree.

- The regrouping design that created `fjs/media/` named the subset `fjs/djs`
  implemented `vnd.fjs.djs`, with the fall-back chain
  `vnd.fjs.djs+vnd.fjs.fjs`.
- The [DataJS specification](../../../spec/datajs/README.md) names DataJS
  `vnd.fjs.datajs+vnd.fjs.fjs`, and says the wider compiler subset keeps
  `vnd.fjs.djs`, "which is the one detail still to reconcile".

`fjs/djs` is gone: its format became [`fjs/media/datajs`](../datajs/README.md)
and its front end [`fjs/fsc`](../../fsc/README.md). No code emits either name
yet. What is not decided is whether `vnd.fjs.djs` still names anything — the
subset `fsc` accepts, say — and, if it does, whether DataJS's chain should
carry it as the segment between `vnd.fjs.datajs` and `vnd.fjs.fjs`, since every
segment must be valid as everything to its right.

### Tasks

- [ ] Decide whether `vnd.fjs.djs` survives, and what it names.
- [ ] Settle DataJS's chain accordingly and state it once, in
      [`fjs/media/README.md`](../README.md)'s "Dialects" section and the DataJS
      specification.

### Related

- [`fjs/media/README.md`](../README.md) — the dialect naming rule and
  fall-back chains.
- [`spec/datajs/README.md`](../../../spec/datajs/README.md) — the DataJS media
  type and dialect.
