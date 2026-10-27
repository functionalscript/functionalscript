## The largest `Vec` chunker, exported once

**Priority:** P4
**Status:** open

### Problem

Three modules cut a byte list into the longest `Vec`s the representation
holds, and each writes the same line under its own name:

```js
const vecChunks = u8ListToVecChunksMsb(Number(maxLengthBytes))   // git/refstore/write
const chunksOf  = u8ListToVecChunksMsb(Number(maxLengthBytes))   // cas/git
const chunks    = u8ListToVecChunksMsb(Number(maxLengthBytes))   // ci/cache
```

The conversion `Number(maxLengthBytes)` is written again as
`effects/node`'s `_maxVecBytes`, `git/packstore`'s `windowBytes`, and inline
in `git/refstore/name` and in this module's own argument check. Every caller
means the same thing — bytes as stream chunks of the largest size — and
[`module.f.mjs`](../module.f.mjs) is where that size is defined.

### Proposal

Two exports from this module: the limit as a `number`, named for what it is,
and `u8ListToMaxVecChunksMsb`, the chunker at that limit. The three private
bindings and `_maxVecBytes` become imports.

### Tasks

- [ ] The two exports with proof lines.
- [ ] `git/refstore/write`, `cas/git`, `ci/cache`, `effects/node`,
      `git/packstore`, `git/refstore/name` over them.

### Related

- [byte-aligned-vec](./byte-aligned-vec.md) — a byte-aligned type, where the
  limit would live if that lands.
