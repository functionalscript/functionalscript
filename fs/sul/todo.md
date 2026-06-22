# 76. Serialization mapping should be done only once.

**Priority:** P3
**Status:** open

For example, instead of
```rust
fn serialize(v: bool) => u8 {
    if v == false { 0 } else { 1 }
}
fn deserialize(v: u8) => bool {
    if v == 0 { false } else { true }
}
```
we should have something like this
```rust
const BOOL_MAP: ... = [(false, 0), (true, 1)];
```

---

# 80. Add `CONST_REF` to serialization.

**Priority:** P3
**Status:** open

---

# 186. `sul/id`: reuse `sha2`'s `fromV8` to pack a hash into a bigint

**Priority:** P3
**Status:** open

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

---

# 66M-sul-literal-level-reuse. `literalToVec` rebuilds the SUL levels the pipeline already holds

**Priority:** P4
**Status:** open

## Problem

`fs/sul/level/literal/module.f.ts` states one fact — *the first three literal SUL
levels have exponents `0n`, `2n`, `7n`* — but states it **twice**, and builds the
three `Level` objects **twice**.

First, eagerly, for the streaming pipeline:

```ts
// fs/sul/level/literal/module.f.ts:88-90
const l1 = level(0n)
const l2 = level(2n)
const l3 = level(7n)
```

Then again, lazily, for the bit-vector decoders — `literalToVec` takes the
exponent `e` and calls `level(e)` *internally*:

```ts
// :118-131
const literalToVec = (prior: LiteralToVec, e: bigint): LiteralToVec => {
    const m = map(prior)
    const { decode } = level(e)            // <- second construction of the same Level
    return literal => listToVec(m(decode(literal)))
}

export const literal1ToVec: LiteralToVec = literalToVec(vec1, 0n)   // 0n repeated
export const literal2ToVec: LiteralToVec = literalToVec(literal1ToVec, 2n)  // 2n repeated
export const literal3ToVec: LiteralToVec = literalToVec(literal2ToVec, 7n)  // 7n repeated
```

So `level(0n)`, `level(2n)`, `level(7n)` are each constructed once for the encoder
(`l1`/`l2`/`l3`) and a second time inside `literalToVec`, and the exponent triple
`0n, 2n, 7n` is written in two separate places that must stay in lockstep. Adding
a level, or changing an exponent, means editing both lists or the two stay
inconsistent — a classic single-source-of-truth violation.

## Proposal

`literalToVec` only needs the level's `decode`, which the already-built `l1`/`l2`/
`l3` expose. Pass the `Level` (or its `decode`) instead of the exponent, and
derive the decoders from the same three objects the pipeline uses:

```ts
const literalToVec = (prior: LiteralToVec, { decode }: Level): LiteralToVec => {
    const m = map(prior)
    return literal => listToVec(m(decode(literal)))
}

export const literal1ToVec: LiteralToVec = literalToVec(vec1, l1)
export const literal2ToVec: LiteralToVec = literalToVec(literal1ToVec, l2)
export const literal3ToVec: LiteralToVec = literalToVec(literal2ToVec, l3)
```

Now the exponents `0n, 2n, 7n` appear exactly once (in `l1`/`l2`/`l3`), `level`
is called three times instead of six, and the encoder pipeline and the
`*ToVec` decoders are visibly built from the *same* three `Level` values rather
than two parallel constructions that happen to agree. Behaviour is unchanged —
`literalToVec` already used only `decode` from the `level(e)` it built.

## Tasks

- [ ] Change `literalToVec`'s second parameter from `e: bigint` to a `Level` (or
      `{ decode }`), drop the internal `level(e)` call, and pass `l1`/`l2`/`l3`
      at the three call sites.
- [ ] Run `npx tsc` and `fjs t`; confirm `fs/sul/level/literal/proof.f.ts` still
      passes with full line/branch coverage.

## Related

- The same module's `pipelineStep` (`:102-110`) is the other consumer of
  `l1`/`l2`/`l3`; after this change both consumers share one set of `Level`
  objects.

---

