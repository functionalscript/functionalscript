## A malformed ref or tree reads as an absent one

**Priority:** P4
**Status:** open

### Problem

`snapshot` in [`fjs/cas/git`](../module.f.mjs) reads the branch's snapshot
ref through [`fjs/git/refstore`](../../../git/refstore/module.f.mjs)'s
`tryResolve`, and `casAt` walks a key's path through
[`fjs/git/walk`](../../../git/walk/module.f.mjs)'s `tryEntry`. Both
primitives answer `null` for every way a question can fail to name a
value, by design and at length in their documentation: to a caller asking
"what is here", nothing and something unreadable are one answer. The CAS
reads them as the ordinary absence:

- a snapshot ref whose loose file holds bytes that are no ref, a symbolic
  ref whose target is none, or a `packed-refs` Git refuses, opens the
  **empty** snapshot, as a branch never fetched does, and every key is
  "not in the snapshot";
- a path component whose entry has subtree mode `40000` but whose id names
  a blob or bytes no tree reads as, or a commit whose root tree is not
  readable as one, is the ordinary miss `ENOENT` for the key, as a path the
  tree does not take is.

`git rev-parse` on the ref and `git cat-file` on the tree refuse those
inputs, and so should this, as `snapshotHeadCode` and `casEntryCode`
respectively: a corrupt repository answering "not here" is a plausible
wrong value where a refusal is owed
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
A missing *object* is already told apart — `present` turns the store's
`ENOENT` into `casEntryCode` — because the store reports it on the error
channel; these cases are the ones the primitives fold into `null`.

### Proposal

The distinction belongs to the primitives, since only they know which way a
lookup failed: `tryResolve` and `tryEntry` would answer a three-way value —
found, absent, malformed — or a second entry point each would refuse where
the current one answers `null`. That is a change to `fjs/git`'s API with its
own measurements against Git, and the CAS then maps the malformed answer to
its codes above. Re-deriving the distinction here by reading the ref file
or the tree objects again would be a second implementation of the lookup
that drifts from the first.

### Tasks

- [ ] `tryResolve` tells a malformed ref from an absent one — measured
      against `git rev-parse` on a loose file that is no ref, a dangling
      symbolic ref and a refused `packed-refs`.
- [ ] `tryEntry` and `tryEntries` tell a malformed tree from a path the tree
      does not take — measured against `git cat-file` on a `40000` entry
      naming a blob and on a commit whose tree is no tree.
- [ ] `snapshot` refuses the first as `snapshotHeadCode` and `casAt` the
      second as `casEntryCode`, with proofs over the inputs above.
