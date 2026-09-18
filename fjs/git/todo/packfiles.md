## Packfiles and `.idx`

**Priority:** P3
**Status:** open

### Problem

[`fjs/git/packstore`](../packstore/module.f.mjs) reads an id out of a pack
below `objects/pack/`, and `fjs/git/store` reads the loose file and the packs
alike — so the readers in this module read a fresh clone, where `git clone`
and `git gc` leave almost nothing loose.

What was left was one pack a reader seemed unable to answer for on its own: a
`refDelta` whose base is not in the pack that names it. Measuring it closed the
question rather than opening the work, because **Git refuses such a pack as
well, with the base in reach.**

Two hand-built v2 packs on Git 2.43.0, alike but for where the base sits — the
same delta instructions, the same index shape, and the crc32 the index carries
computed over the entry as it lies in the pack:

| the base | `git cat-file -p <target>` |
| --- | --- |
| the pack's own first entry | exit 0, the object |
| loose, *and* in a second pack beside it | exit 128, `fatal: Not a valid object name` |

The first row is the control that makes the second mean anything: the same
delta, read, so the construction is sound. `git fsck` calls the second
`failed to validate delta base reference at offset <n>` — it is a broken pack,
not an object kept somewhere else. `git index-pack` will not complete one
either: `--fix-thin` appends the bases a fetched pack lacked, which is why a
pack on disk normally carries its own.

So `packstore`'s refusal is not a gap, and resolving the base through the whole
store would answer for a pack every Git refuses — the same shape as answering
for the two-byte delta `fjs/git/pack`'s floor was added to stop. What remains is
a **choice** rather than a task, and it is recorded as one below.

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
- [x] A `refDelta` whose base is not in the same pack: refused, which is what
      Git does with the same pack — measured above, with the base in the pack as
      the control. `packstore`'s `baseNotInPack` pins the refusal and carries the
      measurement. Nothing is resolved through the store, so `packstore` stays a
      reader of one directory and does not call back into `fjs/git/store`.
- [ ] **Decide whether to be deliberately more capable than Git here**, which is
      the only thing left and is a choice, not a gap. Resolving the base through
      `readIn` would read a thin pack Git calls broken. It could not answer
      *wrongly* — whatever the delta produces is hashed against the id asked
      for — so this is unlike the inputs the delta floor refuses. Against it:
      `git fsck` reports such a pack, so reading it silently hides what Git
      reports; no Git command writes one; and it would make `fjs/git/store` and
      `fjs/git/packstore` mutually recursive, where today the dependency runs one
      way. The cost of *not* deciding is nil, since the refusal names the pack,
      the offset and the base id.

### Related

- [`fjs/git/README.md`](../README.md) — the readers a pack feeds, and the
  framing table that puts a pack on the decoder side.
- [object-store.md](./object-store.md) — the walk that chooses between
  loose and packed.
