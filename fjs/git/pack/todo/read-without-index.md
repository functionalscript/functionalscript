## Read a pack without an index

**Priority:** P3
**Status:** open

### Problem

A pack is read today only through the `.idx` beside it
([`packstore`](../../packstore/module.f.js)): the index says where each entry
begins, and an entry carries no length of its own. A pack that arrives over the
network has no index. `git fetch` answers `git-upload-pack` with the pack alone,
and Git builds the index itself with `git index-pack`.

So a client that fetches a repository, a browser most of all, where there is no
`git` to run, cannot read what it fetched with these modules. The pieces are all
here — [`pack`](../module.f.js)'s `tryHeader`, `tryEntry` and `tryApplyDelta`,
[`inflater`](../../inflater/module.f.js), which finds where a zlib stream ends,
and [`oid`](../../oid/module.f.js)'s `digestOf` — but nothing walks a pack
from the front with them.

The first user is a web client that fetches a repository's history through a
Cloudflare Worker and verifies and replays its commits in the browser.

### Proposal

A pure reader from a whole pack's bytes to its objects, what `git index-pack`
computes:

1. Read the header and its object count.
2. Walk the entries from the front: each entry's header, then its zlib stream,
   whose end is where the next entry begins.
3. Resolve `ofsDelta` and `refDelta` entries against bases in the same pack. A
   `refDelta` may name a base stored after it, as `packstore` already allows.
   A base not in the pack is refused, as in
   [thin-pack-base](../../packstore/todo/thin-pack-base.md).
4. Hash each object to its id, and check the trailing checksum over the pack.
5. Answer a lookup from id to object, the shape `packstore`'s `tryRead` answers,
   so the commit and tree readers and [`walk`](../../walk/module.f.js) take
   either.

Refuse a pack that does not read whole: a short or extra byte, an object count
that does not match the entries, a bad checksum, an unresolved delta.

### Tasks

- [ ] Walk the entries of a pack from the front, with where each one ends.
- [ ] Resolve the deltas and hash every object to its id.
- [ ] Check the trailing checksum and the object count.
- [ ] A lookup from id to object over the result, read by `walk`.
- [ ] Proof against packs written by `git pack-objects`, including both delta
      kinds.

### Related

- [`packstore`](../../packstore/module.f.js) — reads the same entries through
  an index.
- [thin-pack-base](../../packstore/todo/thin-pack-base.md) — the refusal of a
  base outside the pack.
- [delta-ceiling](./delta-ceiling.md) — the delta size limit this reader
  inherits.
