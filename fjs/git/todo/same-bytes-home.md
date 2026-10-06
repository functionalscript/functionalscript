## same-bytes-home. `sameBytes` lives in `refname`, which most of its importers are not about

**Priority:** P5
**Status:** open

### Problem

[`fjs/git/refname`](../refname/module.f.mjs) exports `sameBytes`, a
re-binding of `sameItems`, and `object`'s `tryType`, `header`'s `isKey`,
`walk`, `ref` and `refstore` import it from there. An object type name
and a header key are not ref names; those modules depend on the ref-name
module for a byte comparison alone. [`fjs/git/bytes`](../bytes/module.f.mjs)
looks like the home, but is not: its contract is that every reader
takes an indexed array, never a lazy `Bytes`, while `sameBytes` compares
lazy lists and its proof passes a thunk-backed one. The comparison is
[`fjs/types/list`](../../types/list/module.f.mjs)'s `sameItems`, which
`refname` re-binds under a narrower name and nothing else.

### Proposal

Delete the re-binding: `refname` and its five importers call
`sameItems` from `fjs/types/list`, which accepts the lazy lists
`sameBytes` accepts today, so no input changes meaning and
`fjs/git/bytes`'s array-only contract is left alone. That removes a
public export from `refname`, which is the point — one home, and it
already exists — so the implementing PR declares it under `Changelog:`
as a `**BREAKING CHANGES:**` item, rather than keeping a re-export that
would leave the second name in place.

### Tasks

- [ ] `sameBytes` deleted; `refname` and its importers on `sameItems`;
      the removed `refname` export declared in the PR's `Changelog:`
      section.
- [ ] `tsc`, `fjs test`.

### Related

- [name-and-scope-modules](../refstore/todo/name-and-scope-modules.md) —
  names `sameBytes` as already shared; this is where it is shared from.
