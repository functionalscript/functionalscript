## A malformed ref reads as an absent one

**Priority:** P4
**Status:** open

### Problem

`snapshot` in [`fjs/cas/git`](../module.f.mjs) reads the branch ref through
[`fjs/git/refstore`](../../../git/refstore/module.f.mjs)'s `tryResolve`,
which answers `null` for every way a name can fail to name an id, by design
and at length in its documentation: to a caller asking "what is here",
nothing and something unreadable are one answer. The CAS reads it as the
ordinary absence: a branch ref whose loose file holds bytes that are no
ref, a symbolic ref whose target is none, or a `packed-refs` Git refuses,
opens the **empty** snapshot, as a branch nobody has created does, and
every key is "not in the snapshot".

`git rev-parse` on such a ref refuses it, and so should this, as
`snapshotHeadCode`: a corrupt repository answering "not here" is a
plausible wrong value where a refusal is owed
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
A missing *object* is already told apart — `present` turns the store's
`ENOENT` into `casEntryCode` — because the store reports it on the error
channel, and a malformed tree is refused by the module's own walk, which
reads every tree on a path itself; the ref is the one lookup left to a
primitive that folds the answer.

### Proposal

The distinction belongs to the primitive, since only it knows which way the
lookup failed: `tryResolve` would answer a three-way value — found, absent,
malformed — or a second entry point would refuse where the current one
answers `null`. That is a change to `fjs/git`'s API with its own
measurements against Git, and the CAS then maps the malformed answer to
`snapshotHeadCode`. Re-deriving the distinction here by reading the ref
file and `packed-refs` again would be a second implementation of the lookup
that drifts from the first.

### Tasks

- [ ] `tryResolve` tells a malformed ref from an absent one — measured
      against `git rev-parse` on a loose file that is no ref, a dangling
      symbolic ref and a refused `packed-refs`.
- [ ] `snapshot` refuses it as `snapshotHeadCode`, with proofs over those
      inputs.
