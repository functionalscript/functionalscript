## The inverse of `u8ListToVecChunksMsb`

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) owns one direction between a byte list
and a list of `Vec` chunks: `u8ListToVecChunksMsb` and
`u8ListToMaxVecChunksMsb` cut bytes into chunks. The other direction, and
the size of a chunk list, are written by each consumer:

```js
// effects/node: readWholeBytes
chunks => chunks.reduce((bytes, v) => concat(bytes)(u8ListMsb(v)), /** @type {List<number>} */ (null))
// git/inflater: bytesOf and sizeOf
export const bytesOf = output => flat(map(u8ListMsb)(output))
export const sizeOf = output => toArray(output).reduce((total, v) => total + Number(bytesIn(length(v))), 0)
// cas/git, inside branchCas
const bytesOf = chunks => flat(map(u8ListMsb)(chunks))
// effects/node/virtual: fileSizeBytes
const fileSizeBytes = chunks => chunks.reduce((acc, c) => acc + Number(byteLength(c)), 0)
```

in [`fjs/effects/node`](../../../effects/node/module.f.mjs),
[`fjs/git/inflater`](../../../git/inflater/module.f.mjs),
[`fjs/cas/git`](../../../cas/git/module.f.mjs) and
[`fjs/effects/node/virtual`](../../../effects/node/virtual/module.f.mjs).
`inflater` re-derives this module's own `byteLength` as
`Number(bytesIn(length(v)))`, twice, and
[`fjs/zlib/inflate`](../../../zlib/inflate/module.f.mjs) spells it the same
way. The array form of the forward direction,
`toArray(u8ListToMaxVecChunksMsb(bytes))`, is a private `chunked` in
[`fjs/git/refstore/write`](../../../git/refstore/write/module.f.mjs) and
inline in `write` of [`fjs/git/loose`](../../../git/loose/module.f.mjs).
[`fjs/git/packstore`](../../../git/packstore/module.f.mjs)'s `denseBytes`,
`byteArray(u8ListMsb(v))`, is this module's `u8ArrayMsb` with an assertion
`u8ListMsb` already guarantees.

### Proposal

Beside `u8ListToVecChunksMsb`: `u8ListOfChunksMsb: List<Vec> =>
List<number>`, `byteLengthOfChunks: List<Vec> => number`, and
`maxVecChunksMsb: List<number> => readonly Vec[]`, the array the host's
`writeExclusive` takes. The consumers import them; `inflater`'s `bytesOf`
and `sizeOf` go, their two importers taking the exports here, and
`packstore` takes `u8ArrayMsb`.

### Tasks

- [ ] The three exports with proofs.
- [ ] The consumers above over them; delete the local copies.
- [ ] `tsc` and the suites under the changed directories.

### Related

- [byte-aligned-vec](./byte-aligned-vec.md) — a byte-aligned `Vec` type,
  which would make `byteLength` total; not these helpers.
