# 663-crypto-pow. Proof-of-work module under `fs/crypto/pow`

**Priority:** P3
**Status:** wip

## Problem

FunctionalScript has SHA-2, HMAC, secp256k1, and signing helpers under
[`fs/crypto/`](../fs/crypto/README.md), but no module for traditional
proof-of-work (PoW). Applications that need Bitcoin-style work verification —
compact **nBits** target encoding and hash-vs-target comparison — currently
have no shared primitive in the crypto tree.

Leading-zero-bit PoW is a common teaching simplification; Bitcoin compares the
256-bit hash interpreted as a big-endian unsigned integer against a **target**
decoded from the block header **nBits** field. We want that interface, not a
separate bit-counting or floating **difficulty** API.

## Proposal

Add `fs/crypto/pow/` alongside the existing crypto modules (`sha2`, `hmac`,
`secp`, `sign`).

### Semantics (traditional Bitcoin PoW)

**nBits** (block header "bits", 32-bit) compact-encodes the **target**:

- `exponent = nBits >> 24`
- `mantissa = nBits & 0xffffff`
- `target = mantissa × 2^(8 × (exponent − 3))`

Valid PoW: `hash` (uint256) `≤ target`.

- **Hash input:** caller supplies the pre-image as `Vec` (typically
  `concat(header)(nonceOctets)` built outside the module). The module hashes
  with an injected `Sha2` (default `sha256`) and interprets the digest as a
  big-endian unsigned integer via existing `bit_vec` helpers (`uint` /
  `unpack`).
- **Verify** decodes `nBits` → `target`, recomputes the hash, and checks
  `hash ≤ target` — no bit scanning, no difficulty-to-target conversion.

Reject malformed **nBits** (e.g. mantissa with high bit set when exponent is
minimal, or target exceeding 256 bits) per Bitcoin consensus rules; document
the exact checks in module JSDoc.

### API sketch

Home: `fs/crypto/pow/module.f.ts` (standard `@module` JSDoc header).

```ts
import type { Sha2 } from '../sha2/module.f.ts'
import type { Vec } from '../../types/bit_vec/module.f.ts'

/** Decode compact nBits (32-bit) to a 256-bit target. Throws on invalid nBits. */
export const targetFromNBits: (nBits: bigint) => bigint

export type Pow = {
  /** Hash `data` with the configured `Sha2`; digest as big-endian uint256. */
  readonly hashInt: (data: Vec) => bigint
  /** Whether `hashInt(data) <= targetFromNBits(nBits)`. */
  readonly meets: (nBits: bigint) => (data: Vec) => boolean
  /** Same as `meets` — shaped for proof verification. */
  readonly verify: (nBits: bigint) => (data: Vec) => boolean
}

/** Build PoW helpers for a hash function (default consumer: `sha256`). */
export const pow: (hash: Sha2) => Pow
```

Keep **`mine` / search loops out of the module** for now: mining is
effectful/iterative and belongs in application or test code that calls
`meets` repeatedly. The module provides `targetFromNBits` and the pure
hash-vs-target predicate.

### Test vectors

Use well-known **nBits** / **target** pairs from Bitcoin (document in
`proof.f.ts`):

| nBits | target |
|-------|--------|
| `0x1d00ffff` (genesis) | `0x00000000ffff0000000000000000000000000000000000000000000000000000` |

Assert `targetFromNBits(0x1d00ffffn)` equals the genesis target, and that a
fixed header/nonce pair passes or fails `meets` for easy vs hard **nBits**.

### Module layout

| File | Role |
|------|------|
| `fs/crypto/pow/module.f.ts` | `targetFromNBits`, `Pow` type, `pow` |
| `fs/crypto/pow/proof.f.ts` | Genesis nBits decode + meets/verify cases |
| `fs/crypto/pow/README.md` | nBits compact encoding, hash ≤ target rule |

Register `./fs/crypto/pow/module.f.ts` in `deno.json` `exports`. Update
[`fs/crypto/README.md`](../fs/crypto/README.md) to list `pow`.

### FunctionalScript constraints

- Reuse `computeSync` / `Sha2` from `fs/crypto/sha2` — no Node `crypto`.
- Reuse `uint` / `unpack` from `bit_vec` and `bigint` helpers for target
  arithmetic; no hand-rolled hex parsing in the core module.
- No mutable accumulators in public helpers; follow patterns in
  [`fs/crypto/hmac/module.f.ts`](../fs/crypto/hmac/module.f.ts).
- Tests via `proof.f.ts` + `npm run fst` under `fs/crypto/pow/`.

## Tasks

- [ ] Add `targetFromNBits` with genesis-block test vector (`0x1d00ffff`).
- [ ] Add `fs/crypto/pow/module.f.ts` with `pow(sha256)` (`hashInt`, `meets`, `verify`).
- [ ] Add `proof.f.ts`: invalid nBits rejection, easy nBits pass, hard nBits fail.
- [ ] Register export in `deno.json`; extend `fs/crypto/README.md`.
- [ ] Run `npx tsc`, `npm run fst` in `fs/crypto/pow/`, and `npm run update`.

## Related

- [`fs/crypto/sha2/`](../fs/crypto/sha2/module.f.ts) — hash primitive.
- [`fs/crypto/hmac/`](../fs/crypto/hmac/module.f.ts) — module layout / `proof.f.ts` pattern.
- [i052-poker](./052-poker.md) — mentions PoW-adjacent timing; orthogonal to this module.

## References

- Bitcoin compact target (nBits): [Developer Reference — Target](https://developer.bitcoin.org/reference/block_chain.html#target)
- Existing crypto tree: [fs/crypto](https://github.com/functionalscript/functionalscript/tree/main/fs/crypto)
