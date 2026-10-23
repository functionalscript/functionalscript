## A malformed `packed-refs` reads as an absent ref

**Priority:** P4
**Status:** open

### Problem

`snapshot` and `branchCas` in [`fjs/cas/git`](../module.f.mjs) read the
branch ref through [`fjs/git/refstore`](../../../git/refstore/module.f.mjs)'s
`tryResolve`, which answers `null` for every way a name can fail to name an
id, by design and at length in its documentation: to a caller asking "what
is here", nothing and something unreadable are one answer. The module tells
a loose ref file apart itself — where `tryResolve` answers `null`, one
`stat` of `refs/heads/<branch>` finds the file that is there and names no
commit, and refuses it as `snapshotHeadCode` — so a loose file holding no
id and a symbolic ref to nothing are refused, read or written.

A `packed-refs` Git refuses is the case left: `tryResolve` answers `null`
for the whole file, no loose file is there to `stat`, and the branch reads
as the empty snapshot while a write adds a loose ref beside the packed one
nothing writes over. `git rev-parse` on such a ref refuses it, and so should
this ([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

### Proposal

The distinction belongs to the primitive, since only it knows which way the
lookup failed: `tryResolve` would answer a three-way value — found, absent,
malformed — or a second entry point would refuse where the current one
answers `null`. That is a change to `fjs/git`'s API with its own
measurements against Git, and the CAS then maps the malformed answer to
`snapshotHeadCode` and drops its own `stat`.

### Tasks

- [ ] `tryResolve` tells a malformed ref from an absent one — measured
      against `git rev-parse` on a refused `packed-refs`.
- [ ] `snapshot` and `branchCas` refuse it as `snapshotHeadCode`, with a
      proof over that input, and `headOf`'s `stat` goes.
