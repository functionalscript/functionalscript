# 663-crypto-pow. Proof-of-work module under `fs/crypto/pow`

**Priority:** P3
**Status:** open

## Problem

FunctionalScript has SHA-2, HMAC, secp256k1, and signing helpers under
[`fs/crypto/`](../fs/crypto/README.md), but no module for traditional
proof-of-work (PoW). Applications that need a hashcash-style or
Bitcoin-style work challenge — where validity is expressed as an integer
**difficulty** rather than a leading-zero **bit** count — currently have
no shared primitive in the crypto tree.

Leading-zero-bit PoW is a common teaching simplification; production systems
(Bitcoin, hashcash variants used in protocols) compare the hash interpreted
as a big-endian integer against a **target** derived from a difficulty integer.
We want that model, not a separate bit-counting API.

## Proposal

Add `fs/crypto/pow/` alongside the existing crypto modules (`sha2`, `hmac`,
`secp`, `sign`).

### Semantics (Bitcoin-style difficulty integer)

- **`difficulty`** is a positive `bigint`. Higher difficulty ⇒ harder work
  (smaller target).
- **`maxTarget`** is a fixed ceiling (Bitcoin's `0x00000000FFFF0000…` compact
  genesis target, or a documented FunctionalScript constant — pick one and
  document the choice in the module README).
- **Target:** `target(difficulty) = maxTarget / difficulty` (integer division;
  reject `difficulty === 0n`).
- **Hash input:** caller supplies the pre-image as `Vec` (typically
  `concat(challenge)(nonceOctets)` built outside the module). The module hashes
  with an injected `Sha2` (default `sha256`) and interprets the digest as a
  big-endian unsigned integer via existing `bit_vec` helpers (`uint` / `unpack`).
- **Valid proof:** `hashValue <= target(difficulty)`.
- **Verify** recomputes the hash and checks the inequality — no bit scanning.

This deliberately avoids a `leadingZeros(hash) >= n` API. If a caller wants a
bit threshold, they can derive an equivalent target offline; the module stays
on integer difficulty.

### API sketch

Home: `fs/crypto/pow/module.f.ts` (standard `@module` JSDoc header).

```ts
import type { Sha2 } from '../sha2/module.f.ts'
import type { Vec } from '../../types/bit_vec/module.f.ts'

export type Pow = {
  /** Documented genesis-style ceiling used for target derivation. */
  readonly maxTarget: bigint
  /** `maxTarget / difficulty`; throws or returns error for `difficulty === 0n`. */
  readonly target: (difficulty: bigint) => bigint
  /** Hash `data` with the configured `Sha2` and return digest as big-endian integer. */
  readonly hashInt: (data: Vec) => bigint
  /** Whether `hashInt(data) <= target(difficulty)`. */
  readonly meets: (difficulty: bigint) => (data: Vec) => boolean
  /** Alias shaped for proof verification: same as `meets`. */
  readonly verify: (difficulty: bigint) => (data: Vec) => boolean
}

/** Build PoW helpers for a hash function (default consumer: `sha256`). */
export const pow: (hash: Sha2) => Pow
```

Optional convenience (only if a second consumer appears — otherwise inline at
call site):

```ts
/** Append big-endian `nonce` octets to `prefix` — thin `bit_vec` wrapper. */
export const withNonce: (prefix: Vec) => (nonce: bigint) => Vec
```

Keep **`mine` / search loops out of the module** for now: mining is
effectful/iterative and belongs in application or test code that calls
`meets` repeatedly. The module provides the pure predicate and target math.

### Module layout

| File | Role |
|------|------|
| `fs/crypto/pow/module.f.ts` | `Pow` type, `pow`, `maxTarget`, target/verify |
| `fs/crypto/pow/proof.f.ts` | Known-vector checks (easy difficulty passes, hard fails) |
| `fs/crypto/pow/README.md` | Difficulty-vs-target semantics, `maxTarget` rationale |

Register `./fs/crypto/pow/module.f.ts` in `deno.json` `exports`. Update
[`fs/crypto/README.md`](../fs/crypto/README.md) to list `pow`.

### FunctionalScript constraints

- Reuse `computeSync` / `Sha2` from `fs/crypto/sha2` — no Node `crypto`.
- Reuse `uint` / `vec` / `concat` from `bit_vec` and `bigint` helpers; no
  hand-rolled hex parsing in the core module.
- No mutable accumulators in public helpers; follow patterns in
  [`fs/crypto/hmac/module.f.ts`](../fs/crypto/hmac/module.f.ts).
- Tests via `proof.f.ts` + `npm run fst` under `fs/crypto/pow/`.

## Tasks

- [ ] Add `fs/crypto/pow/module.f.ts` with documented `maxTarget` and `pow(sha256)`.
- [ ] Add `proof.f.ts` with at least: zero/invalid difficulty rejection, a
  low difficulty that a fixed `(prefix, nonce)` satisfies, and a high difficulty
  that the same pair fails.
- [ ] Register export in `deno.json`; extend `fs/crypto/README.md`.
- [ ] Run `npx tsc`, `npm run fst` in `fs/crypto/pow/`, and `npm run update`.

## Related

- [`fs/crypto/sha2/`](../fs/crypto/sha2/module.f.ts) — hash primitive.
- [`fs/crypto/hmac/`](../fs/crypto/hmac/module.f.ts) — module layout / `proof.f.ts` pattern.
- [i052-poker](./052-poker.md) — mentions PoW-adjacent timing; orthogonal to this module.

## References

- Bitcoin difficulty/target: [Developer Reference — Target](https://developer.bitcoin.org/reference/block_chain.html#target)
- Existing crypto tree: [fs/crypto](https://github.com/functionalscript/functionalscript/tree/main/fs/crypto)
