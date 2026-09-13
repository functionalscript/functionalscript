## Reading a pack index builds every id whether or not a caller asks for one

**Priority:** P3
**Status:** open

### Problem

[`tryIdx`](../module.f.mjs) answers an [`Idx`](../types.ts) whose `ids` is an
array of `Oid`, so every id in the file becomes a bit vector — a `bigint` — as
the file is read. A lookup then uses `Math.floor(n / 2)` of them and none of the
rest.

Measured on a synthetic 100,000-object version 2 index of 2.80 MB, on node 22:

| step | cost |
| --- | --- |
| the trailing checksum's hash | 2122 ms |
| materialising 100,000 ids as vectors | 1161 ms |
| everything else `tryIdx` does | 215 ms |
| **`tryIdx` in total** | **3498 ms** |

A real repository's index is larger than this fixture: `git gc` on a
kernel-sized history writes millions of objects, where the same shape is tens of
seconds and hundreds of megabytes of live vectors.

Two scans that used to sit beside this are already gone — a filter per fanout
bucket (427 ms → 1 ms) and an array allocated per pair of ids while checking the
order (137 ms → 4 ms) — so what is left is the eager shape itself and not a loop
that can be tightened.

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

- [`fjs/git/packidx/module.f.mjs`](../module.f.mjs) — the module header carries
  the same figures, beside the two scans that were fixed.
