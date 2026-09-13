## Packfiles and `.idx`

**Priority:** P3
**Status:** open

### Problem

[`fjs/git/loose`](../loose/module.f.mjs) reads a loose object, and in a
fresh clone almost nothing is loose: `git clone` and `git gc` put objects
in `.git/objects/pack/*.pack`, so the readers in this module read a real
repository poorly until they can read a pack. The name-resolution and
signature issues under [`todo/`](../../../todo/) both walk clones.

### Proposal

A packfile is length-framed throughout, so it is a decoder in the
[`fjs/asn.1`](../../asn.1/module.f.mjs) style and not a grammar: the header
(`PACK`, a version, a count), then per object a varint type-and-size, and
for the two delta kinds a base — an offset back into the pack, or an id —
and a delta stream of copy and insert instructions, each entry's data a
zlib stream. The `.idx` beside it is a fanout table and sorted ids with
offsets, the lookup from an id to an entry.

- A pure decoder over a byte list for the pack's framing and the delta
  instructions, refusing what it cannot frame.
- The zlib streams go through `inflate`, as a loose object's does, until
  [`todo/inflate.md`](../../../todo/inflate.md) is done; a pack entry's
  stream is one more caller of the same effect.
- Resolving a delta chain to an object is a fold over its bases; the
  result is the same `Envelope`-shaped value the loose reader returns, so
  everything above it reads the two alike.
- Reading `.idx` first, then the pack at the offset it names, through
  `readBytes`; a pack larger than a `Vec` is read a window at a time, which
  is what `readBytes` is for.

Multi-pack indexes, bitmaps and the reverse index are not needed to read
objects and are not part of this issue. The reverse index is where an entry's
length would come from for free, and its absence is what makes the reader scan
the index's offsets for the next one up — see `after` in
[`fjs/git/packidx`](../packidx/module.f.mjs) for that trade, measured.

### Tasks

- [x] `.idx`: fanout, ids, offsets, and the lookup.
- [x] Pack header and entry framing, the two delta kinds, and the delta
      instructions.
- [x] A fixture: a small pack Git wrote, captured once, with a delta in it.
- [x] `tryRead(id)` over a pack directory, returning what the loose reader
      returns: [`fjs/git/packstore`](../packstore/module.f.mjs), and
      `fjs/git/store` reading the loose file and the packs alike.
- [ ] A `refDelta` whose base is not in the same pack. Such a pack is one
      `index-pack --fix-thin` did not complete — measured: storing a thin pack
      appends the bases it lacked, so a pack on disk normally carries its own —
      and `packstore` refuses one rather than guess where the base lives. The
      base may be loose, in another pack, or nowhere, so resolving it is the
      whole store's question and belongs with the `read(id)` of
      [object-store.md](./object-store.md), not under one pack.

### Related

- [`fjs/git/README.md`](../README.md) — the readers a pack feeds, and the
  framing table that puts a pack on the decoder side.
- [object-store.md](./object-store.md) — the walk that chooses between
  loose and packed.
