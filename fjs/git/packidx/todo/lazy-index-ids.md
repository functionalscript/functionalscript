## Reading a pack index builds every id whether or not a caller asks for one

**Priority:** P3
**Status:** open

### Problem

[`tryIdx`](../module.f.mjs) answers an [`Idx`](../types.ts) whose `ids` is an
array of `Oid`, so every id in the file becomes a bit vector — a `bigint` — as
the file is read. A lookup then uses `Math.floor(n / 2)` of them and none of the
rest.

Measured at `fe723022`, on node 22, over a synthetic 100,000-object version 2
index of 2.80 MB:

| step | cost |
| --- | --- |
| the trailing checksum's hash | 2148 ms |
| materialising 100,000 ids as vectors | 1116 ms |
| everything else `tryIdx` does | 309 ms |
| **`tryIdx` in total** | **3573 ms** |

A real repository's index is larger than this fixture: `git gc` on a
kernel-sized history writes millions of objects, where the same shape is tens of
seconds and hundreds of megabytes of live vectors.

Two scans that used to sit beside this are already gone, both measured at the
same commit and on the same fixture: a filter per fanout bucket, 256 passes over
the ids, 425 ms against 1 ms for 256 binary searches; and an array allocated per
pair of ids while checking the order, 130 ms against 4 ms for a recursion over
the width. So what is left is the eager shape itself and not a loop that can be
tightened.

### Proposal

The lookup does not need the ids as values. It needs to *compare* the id it was
given against the id at a position, which is a comparison of `width` bytes
already in hand:

- keep the bytes and the width in `Idx` rather than an array of `Oid`, and
  compare by byte against the query id's bytes — the search then materialises
  nothing at all;
- or keep `ids` as a lazy `List<Oid>`, which costs a vector per *visited*
  position, about `log2(n)` of them per lookup.

The first is faster and the second is a smaller change to the type. Either one
also removes the ordering check's second pass, since the comparison it needs is
the same one.

`packChecksum` stays a vector: there is one of it, and a caller compares it
against the pack's own trailer.

Whether the checksum hash should be optional is a separate question and not this
one — it is the price of refusing a corrupt index, which
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
settles, and `fjs/git/store` already pays the same price per object.

### Related

- [`fjs/git/packidx/module.f.mjs`](../module.f.mjs) — the module header states
  the same cost as a shape, and sends the figures here rather than carrying a
  timing of its own.
