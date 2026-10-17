## Cutting a byte list into `Vec`s is written in `oid` and in `refstore/write`

**Priority:** P3
**Status:** open

### Problem

A `Vec` holds at most `maxLengthBytes`, so a byte sequence that may be longer
is hashed or written as a list of `Vec`s. [`fjs/types/bit_vec`](../module.f.mjs)
exports the conversion of one chunk, `u8ListToVecMsb`, and
[`fjs/effects/node`](../../../effects/node/module.f.mjs)'s `readWholeBytes` is
the inverse, chunks to one byte list. The forward cut is not shared. `chunks`
in [`fjs/git/oid`](../../../git/oid/module.f.mjs) cuts a lazy `List<number>`
into 64 KiB `Vec`s for the hash; `chunked` in
[`fjs/git/refstore/write`](../../../git/refstore/write/module.f.mjs) cuts an
array into `maxLengthBytes` `Vec`s for `writeBytes`:

```js
// oid
const chunks = bytes => () => {
    let rest = bytes
    let taken = 0
    const gathered = Array.from({ length: chunkBytes }, () => { /* next(rest) … */ })
    return taken === 0
        ? null
        : { first: u8ListToVecMsb(taken === chunkBytes ? gathered : gathered.slice(0, taken)), tail: chunks(rest) }
}
// refstore/write
const chunked = bytes => {
    const size = Number(maxLengthBytes)
    return Array.from(
        { length: Math.ceil(bytes.length / size) },
        (_, i) => u8ListToVecMsb(bytes.slice(i * size, (i + 1) * size)))
}
```

[chunk-gathering](../../../git/oid/todo/chunk-gathering.md) shows the first
one pays a whole chunk's walk however few bytes there are. A fix made there is
a fix for one of two copies.

### Proposal

One chunker in `fjs/types/bit_vec`, beside `u8ListToVecMsb`:
`u8ListToVecChunksMsb(chunkBytes)(list): List<Vec>`, lazy over a
`List<number>`, stopping at the list's end — the fix chunk-gathering asks for,
made once. `oid.chunks` becomes a call with its 64 KiB; `write.chunked`
becomes `toArray` of the same over `maxLengthBytes`; a future writer of a
large object takes the same one.

### Tasks

- [ ] `u8ListToVecChunksMsb` with its proof, stopping at the list's end.
- [ ] `oid` and `refstore/write` import it; their private chunkers go.
- [ ] Re-take chunk-gathering's measurements against it, and close that issue
      if they hold.

### Related

- [chunk-gathering](../../../git/oid/todo/chunk-gathering.md) — the cost of
  the `oid` copy; one target once there is one copy.
- [byte-aligned-vec](./byte-aligned-vec.md) — the `Vec` shape the chunks have.
