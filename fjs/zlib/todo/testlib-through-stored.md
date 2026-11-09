## The test library re-blocks what `stored` blocks

**Priority:** P5
**Status:** open

### Problem

[`stored`](../stored/module.f.mjs) cuts a byte list into `0xffff`-byte
blocks through `fjs/types/bit_vec`'s `u8ListToVecChunksMsb` and closes the
stream with the Adler-32 of those blocks:

```js
const blocksOf = u8ListToVecChunksMsb(blockBytes)
…
const checksum = u8ArrayMsb(run(adler32)(blocks))
```

[`testlib.f.mjs`](../testlib.f.mjs), shared by several proofs, writes both
steps again: `closing` slices the bytes by hand with `Array.from` over
`Math.ceil(data.length / 0xffff)` and folds `adler32` over the pieces, and
`storedBytes` chunks its input before handing it to `stored`. The fixture
helper and the module it tests each own the block rule; a change to one is
not seen by the other.

### Proposal

`stored` exports its closing step, say `adlerClosing = bytes =>
u8ArrayMsb(run(adler32)(blocksOf(bytes)))`, and `testlib`'s `closing` is
that export; `storedBytes` chunks through `u8ListToVecChunksMsb`, or
`stored` takes the byte list it blocks anyway and the helper collapses.

### Tasks

- [ ] One owner of the blocking and the closing checksum; `testlib` over
      it.
- [ ] `tsc` and the suite under `fjs/zlib`.
