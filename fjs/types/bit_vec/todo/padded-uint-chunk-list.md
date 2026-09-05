## padded-uint-chunk-list. One owner for "chunk → zero-left-padded unsigned int"

**Priority:** P4
**Status:** open

### Problem

Two modules hand-roll the same subtle conversion of a possibly-short chunk
into its zero-left-padded unsigned value:

```js
// fjs/types/bit_vec/module.f.mjs:449-456 — vecToU8, behind u8List
const unpackSplit8 = unpackSplit(8n)
return chunk => {
    const u = unpack(chunk)
    return Number(u.length < 8n ? unpackSplit8(u)[0] : u.uint)
}

// fjs/basen/module.f.mjs:57-60 — chunkToIndex, behind vecToString
const chunkToIndex = chunk => {
    const u = unpack(chunk)
    return Number(u.length < bits ? unpackSplitBits(u)[0] : u.uint)
}
```

The bodies are character-for-character the same modulo `(bo, 8n)` vs
`(msb, bits)`, and the rule they encode is non-obvious enough that it is
explained in prose at both sites (and again in
`fjs/basen/base64/proof.f.mjs`): a trailing partial chunk is left-padded
because `unpackSplit`'s shift amount goes negative, which per spec becomes a
left shift. An invariant that subtle should live once, in `bit_vec` next to
`unpackSplit` — not be re-derived inside a codec.

There is also a mechanical cost: both consumers go through
`chunkList = mappedChunkList(unpack)(pack)` and then immediately `unpack`
each chunk again, so every chunk is packed and unpacked for nothing.

### Proposal

One export in `fjs/types/bit_vec/module.f.mjs`, built on the existing
`mappedChunkList` so the pack/unpack round trip disappears:

```js
const paddedUint = unpackSplit => n => {
    const us = unpackSplit(n)
    return u => u.length < n ? us(u)[0] : u.uint
}
/** Fixed-size chunks as zero-left-padded unsigned values. */
export const paddedUintChunkList = bo => n =>
    mappedChunkList(unpack)(paddedUint(bo.unpackSplit)(n))(bo)(n)
```

`u8List(bo)` becomes `compose(paddedUintChunkList(bo)(8n))(map(Number))`;
`baseN`'s `vecToString` folds over `paddedUintChunkList(msb)(bits)` and
drops its own `unpackSplit`/`unpack` machinery. The left-padding rationale
moves to `paddedUint`'s JSDoc, its one home.

### Tasks

- [ ] Add `paddedUintChunkList`; express `u8List` and `basen`'s
      `vecToString`/`chunkToIndex` through it.
- [ ] `tsc`, `fjs t`; the `basen` codec proofs pin the padding behavior.

### Related

- [../../../basen/todo/basen-padding-strategy.md](../../../basen/todo/basen-padding-strategy.md)
  — the padding *strategy* one layer up (alphabet-level `=` handling); this
  issue is the bit-level chunk conversion below it.
- [unpack-lift.md](./unpack-lift.md) — lifts other `bo`-dependent helpers;
  same flavor, different functions.
