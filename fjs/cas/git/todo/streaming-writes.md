## Stream a payload into a loose object

**Priority:** P4
**Status:** open

### Problem

`proposal`'s `write` in [`fjs/cas/git`](../module.f.mjs) holds a payload
whole while its blob is written: the loose object's envelope,
`blob <size>\0`, states the size before the first byte, and the Git id is
the hash over envelope and bytes together, so neither the file's name nor
its first bytes are known until the payload has been seen to its end.
`gathered` keeps the chunks, and `writeObject` takes the payload as the
`Bytes` list every writer in [`fjs/git`](../../../git/README.md) takes.

`fileCas` never holds a payload: it streams each chunk to a staging file as
it hashes, and names the file at the end. A payload larger than memory
goes through `fileCas` and not through here.

### Proposal

Two passes, each streaming. Stage the payload as `fileCas` stages one —
to a temporary file below `objects/`, chunk by chunk, counting the bytes
and folding the CAS hash — then read the staged file back once more,
folding the Git hash over the envelope and the bytes as they come and
writing the zlib stream of stored blocks beside them, block by block at
their offsets, and rename the stream into place at the id. The staged
file is removed either way.

`fjs/zlib/stored`'s `stored` would then grow an incremental form — `init`,
a block appended, `end` with the checksum — in the shape of `adler32`, so
the two passes share the framing with the one-shot writer rather than
spelling it twice.

### Tasks

- [ ] An incremental `fjs/zlib/stored`: a block at a time, the checksum
      folded as the blocks go by.
- [ ] `writeObject` over a staged file: the envelope from the staged size,
      the id folded as the file is read, the stream written as it is read.
- [ ] `gathered` keeps no chunks; `write` stages and hashes in one pass and
      hands the staged file to `writeObject`.

### Related

- [`fjs/cas`](../../module.f.mjs) — `writeImpl`, the staging upload this
  would reuse the shape of.
- [`fjs/zlib/stored`](../../../zlib/stored/module.f.mjs) — the one-shot
  writer.
