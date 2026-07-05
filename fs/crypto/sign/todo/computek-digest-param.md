## 66z-computek-digest-param. `sign` hashes the message twice — pass the digest to `computeK`

**Priority:** P3
**Status:** open

### Problem

A single `sign(c)(hf)(x)(m)` runs the message hash **twice** over
identical inputs. In `sign` itself (`fs/crypto/sign/module.f.ts:150-151`):

```ts
const hm = computeSync(hf)([m])
const h = bits2int(hm) % q
```

and then `sign` calls `computeK(a)(hf)(x)(m)`, whose body recomputes the
same digest (`fs/crypto/sign/module.f.ts:86`):

```ts
// a. Process m through the hash function H, yielding:
//      h1 = H(m)
const h1 = computeSync(hf)([m])
```

Both are `computeSync(hf)([m])` with the same `hf` and `m`, so every
signature pays two full SHA-2 passes over the message where RFC 6979
needs one. Beyond the cost, the invariant *"`h` and the nonce derivation
use the same digest"* is maintained by coincidence of two call sites
rather than by construction.

### Proposal

Thread the digest instead of the message: `computeK` accepts the
already-computed `h1: Vec` — `computeK(a)(hf)(x)(h1)` — and `sign`
computes `H(m)` once, reusing `hm` for both `h = bits2int(hm) % q` and the
nonce derivation. `computeK`'s JSDoc keeps the RFC step-a reference but
states the digest is supplied by the caller.

This folds naturally into
[666-crypto-sign-fromcurve](../../todo/666-crypto-sign-fromcurve.md),
which already reshapes the `sign` → `computeK` boundary (composite
`Signer`, shared `bits2int % q` step): whichever lands first, the other
should preserve the single-hash property. `computeK` is exported, so this
is a breaking API change — update all importers in the same PR per
`AGENTS.md`.

### Tasks

- [ ] Change `computeK`'s last parameter from message `m` to digest `h1`;
      update `sign` to pass `hm`.
- [ ] Update `proof.f.ts` call sites and JSDoc.
- [ ] Run `npx tsc` and `fjs t`; verify the RFC 6979 test vectors still
      pass.

### Related

- [666-crypto-sign-fromcurve](../../todo/666-crypto-sign-fromcurve.md) —
  reworks the same `sign`/`computeK` interface; coordinate so both land
  compatibly.
