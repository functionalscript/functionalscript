## sha2-append-quadratic. `append` is quadratic on large single-chunk inputs

**Priority:** P2
**Status:** open
**Blocked by:** —

### Problem

`append` (`fs/crypto/sha2/module.f.ts`) processes the accumulated `remainder`
one fixed-size SHA-2 block at a time:

```ts
append: (v: Vec) => (state: State): State => {
    let { remainder, hash, len } = state
    remainder = concat(remainder)(v)
    let remainderLen = length(remainder)
    while (remainderLen >= chunkLength) {
        const [u, nr] = popFront(chunkLength)(remainder)
        hash = compress(hash)(u)
        remainder = nr
        remainderLen -= chunkLength
        len += chunkLength
    }
    ...
}
```

Same shape as the `baseN.vecToString` bug fixed in PR #1202: `popFront` pops a
small, fixed-size chunk (one block — 512 bits for SHA-256) off the front of
`remainder`, and each `popFront` call re-masks the *entire remaining* bigint
through `vec()`'s `m & ui` — cost proportional to the remaining length, not
the block size. Looping that once per block is O(n²) instead of O(n log n).

Benchmarked directly (hashing a single `Vec`, doubling the input size each
time — no CAS/stdio machinery):

| bytes | time |
|---|---|
| 80,000 | 70.9ms |
| 160,000 (2x) | 458.9ms (6.5x) |
| 320,000 (2x) | 3444.1ms (7.5x) |

Worse than quadratic in practice (2x input should be ~4x time for O(n²)) —
likely `concat`'s own `unpack`/`bitLength` cost compounding on top of the
`popFront` loop.

This is hotter than the `base64`/`cbase32` case fixed in PR #1202:
`fileCas.write` (`fs/cas/module.f.ts`) passes the whole content `Vec` (up to
`maxLengthBytes`, 128 KiB) as a single `append` call, so it runs on *every*
`cas_add`, not just `content:true` reads.

### Proposal

Apply the same fix as `baseN.vecToString`: replace the per-block `popFront`
loop with a balanced recursive/divide-and-conquer split (mirroring
`chunkList`/`unpackChunkList`, already used by `u8List` and by concatenation
— PR #1192), so each half is masked to its own length before recursing and
no node's `uint` carries a stale, oversized magnitude.

### Tasks

- [ ] Rewrite `append`'s block-extraction loop to use a balanced split
      instead of repeated `popFront`.
- [ ] Re-run the benchmark above (80,000 / 160,000 / 320,000 bytes) to confirm
      linear-ish scaling (allowing for the fixed per-block `compress` cost).
- [ ] Add a proof test analogous to `fs/base64/proof.f.ts`
      `encodeLargeVecIsSlow` — hash a large `Vec` directly, no timing
      assertion, relying on the test runner's own per-test timing to catch a
      regression.

### Related

- `fs/base_n/module.f.ts` `vecToString` / `unpackToString` — the fixed
  sibling bug, PR #1202.
- `fs/types/bit_vec/module.f.ts` `chunkList` / `unpackChunkList` — the
  existing balanced-split helper to mirror.
- `fs/cas/module.f.ts` `fileCas.write` — the hot call site.
