# 666-crypto-sign-fromcurve. `sign` bypasses `fromCurve` and re-derives RFC6979 helpers

**Priority:** P4
**Status:** open

## Problem

`fs/crypto/sign/module.f.ts` already exposes the intended abstraction for "derive
the RFC6979 conversion helpers (`All`) from a `Curve`":

```ts
// fs/crypto/sign/module.f.ts:53
export const fromCurve = (c: Curve): All => all(c.nf.p)
```

But the module's primary in-module consumer, `sign`, ignores it and re-implements
the same derivation by hand:

```ts
// fs/crypto/sign/module.f.ts:141-156
export const sign = (c: Curve) => (hf: Sha2) => (x: bigint) => (m: Vec): Signature => {
    const { nf: { p: q, div }, g } = c   // :143 — pulls q out of the curve manually
    const a = all(q)                      // :144 — this is exactly fromCurve(c)
    const { bits2int } = a
    ...
    const hm = computeSync(hf)([m])
    const h = bits2int(hm) % q            // :156 — duplicates bits2octets' `bits2int(b) % q`
```

Two distinct duplications here:

1. **`const a = all(q)` where `q = c.nf.p` is precisely `fromCurve(c)`.** The
   knowledge of "how to get the subgroup order out of a `Curve`" now lives in two
   places. If `fromCurve` ever gains validation/caching, `sign` silently diverges.

2. **`bits2int(hm) % q` (`:156`) re-implements the "bits2int then extra modular
   reduction" step** that `all` already names internally for `bits2octets`:

   ```ts
   // fs/crypto/sign/module.f.ts:45-46
   // since z2 < 2*q, we can use simple mod with `z1 < q ? z1 : z1 - q`
   bits2octets: b => int2octets(bits2int(b) % q),
   ```

   RFC6979's "extra modular reduction" (documented in the comment at `:148-153`)
   thus appears twice, with the rationale comment split across the two sites.

## Proposal

1. In `sign`, replace `const a = all(q)` with `const a = fromCurve(c)` and read
   `q` (and `bits2int`) from `a`; keep destructuring only `div` and `g` from `c`,
   which `fromCurve` does not provide:

   ```ts
   const a = fromCurve(c)
   const { q, bits2int } = a
   const { nf: { div }, g } = c
   ```

2. Add a named `bits2intModQ: (b: Vec) => bigint` to the `All` record
   (`= b => bits2int(b) % q`), define `bits2octets = b => int2octets(bits2intModQ(b))`
   in terms of it, and use `a.bits2intModQ(hm)` in `sign`. The single comment about
   the conditional-subtraction reduction then has one home.

Part 1 is a near-trivial separation-of-concerns fix where the abstraction already
exists but is bypassed; part 2 is a small DRY win co-locating the RFC rationale.

## Tasks

- [ ] `sign` uses `fromCurve(c)` instead of `all(c.nf.p)`
- [ ] add `bits2intModQ` to `All`; express `bits2octets` and `sign`'s `h` through it
- [ ] confirm `proof.f.ts` still covers all of `all`/`fromCurve`/`sign`

## Related

- `fs/crypto/sign/module.f.ts` — `all` (:32), `fromCurve` (:53), `sign` (:141)
