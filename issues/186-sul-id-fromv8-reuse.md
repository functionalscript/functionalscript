# 186. `sul/id`: reuse `sha2`'s `fromV8` to pack a hash into a bigint

`sul/id` packs the eight 32-bit words of a SHA-2 `V8` result back into a single
256-bit `bigint` by re-deriving the MSB concatenation by hand:

```ts
// fs/sul/id/module.f.ts:125
const hash2 = base32.compress(iv)

const vecX20 = vec(0x20n)

const ltv = listToVec(msb)

const hashMerge = (a: Id, b: Id): Id =>
    hashId(uint(ltv(hash2((asBase(a) << 0x100n) | asBase(b)).map(vecX20))))
```

`hash2(...)` returns a `V8` (eight 32-bit words). The
`uint(ltv(... .map(vecX20)))` chain turns each word into a 32-bit `Vec`,
MSB-concatenates them, and reads the result as a `bigint`. But `sha2` already
exports that exact packing on the `Base` it returns:

```ts
// fs/crypto/sha2/module.f.ts:200
const fromV8 = (a: V8) => a.reduce((p, v) => (p << bitLength) | v)
```

For `base32`, `bitLength === 32n`, so `fromV8` computes
`(((w0 << 32) | w1) << 32 | w2) …` — the identical MSB packing of eight 32-bit
words. `base32.fromV8` is reachable: `fromV8` is a field of the returned `Base`,
and `sul/id` already imports `{ base32, type V8 }` from `sha2`.

## Proposed change

```ts
const hashMerge = (a: Id, b: Id): Id =>
    hashId(base32.fromV8(hash2((asBase(a) << 0x100n) | asBase(b))))
```

This removes `vecX20`, `ltv` (one of the [i167](./README.md) `listToVec(msb)`
aliases), and the `vec`/`listToVec`/`uint` imports that exist in `sul/id` only to
service this one line.

## Why this qualifies

- DRY: `fromV8` ("interpret a SHA word vector as one big-endian integer") is a
  named SHA-2 concept; `sul/id` is the second consumer and currently forks it.
- Separation of concerns: the V8-packing convention should live in the hashing
  module that produces `V8`, not be reconstructed by each caller.

## Caveats

- `fromV8` uses `reduce` with no seed, so it assumes a non-empty array. The input
  here is always length 8 (`iv` is asserted to be a `V8` of length 8 at
  `sul/id:54-56`, and `compress` preserves the shape), so this is safe.
- Behaviorally equivalent for `base32` (32-bit words). It would **not** match a
  64-bit `base64` — but `sul/id` only ever uses `base32`, so there is no risk.
- Verify the surrounding `{ concat } = msb` and other `bit_vec` imports are still
  needed after removing the `uint`/`vec`/`listToVec` uses; prune whatever becomes
  unused.

## Related

- [i167](./README.md) — `listToVec(msb)` re-binding (`ltv` here is one instance).
