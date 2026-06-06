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

1. **Make `fromCurve` the complete "curve → signing context" factory** so `sign`
   reads everything it needs from one place and never re-reaches into `c`.

   This is the fuller version of an option raised in review: rather than just
   swapping `all(q)` for `fromCurve(c)` and *still* hand-pulling `div`/`g` off the
   curve, extend `fromCurve`'s result to bundle the curve-derived inputs `sign`
   uses. Note `sign` reaches into the curve for **three** things — `div`
   (`:186`), `g` and `mul` (`:172`, `c.mul(k)(g)`) — so a half-measure that adds
   only `div`/`g` would still leave `sign` touching `c` for `mul`. Bundle all three:

   ```ts
   export type Signer = All & {
       readonly div: Curve['nf']['div']
       readonly mul: Curve['mul']
       readonly g: Curve['g']
   }
   export const fromCurve = (c: Curve): Signer =>
       ({ ...all(c.nf.p), div: c.nf.div, mul: c.mul, g: c.g })
   ```

   Then `sign` destructures solely from `fromCurve(c)`:

   ```ts
   const a = fromCurve(c)
   const { q, bits2int, div, mul, g } = a
   ...
   const k = computeK(a)(hf)(x)(m)   // Signer extends All, so this still type-checks
   const rxy = mul(k)(g)
   ```

   Crucially, **`all(q)` stays the pure, `q`-only RFC6979 factory** (`All`) that
   `computeK` consumes — `computeK` needs none of `div`/`mul`/`g`, so the focused
   `All` abstraction is preserved and `fromCurve` becomes the single curve-aware
   layer on top of it. This answers the review question affirmatively: `fromCurve`
   *should* provide the curve pieces (`div`, `g`, and `mul`), not just `div`/`g`.

2. Add a named `bits2intModQ: (b: Vec) => bigint` to the `All` record
   (`= b => bits2int(b) % q`), define `bits2octets = b => int2octets(bits2intModQ(b))`
   in terms of it, and use `a.bits2intModQ(hm)` in `sign`. The single comment about
   the conditional-subtraction reduction then has one home.

Part 1 is the separation-of-concerns fix: `fromCurve` already exists but is both
bypassed by `sign` and too thin to fully serve it; part 2 is a small DRY win
co-locating the RFC rationale.

## Tasks

- [ ] extend `fromCurve` to return a `Signer` (`All` + `div`/`mul`/`g`); keep `all`
      as the pure `q`-only `All` factory `computeK` uses
- [ ] `sign` destructures only from `fromCurve(c)` — no direct `c.nf`/`c.mul`/`c.g` access
- [ ] add `bits2intModQ` to `All`; express `bits2octets` and `sign`'s `h` through it
- [ ] confirm `proof.f.ts` still covers all of `all`/`fromCurve`/`sign`

## Related

- `fs/crypto/sign/module.f.ts` — `all` (:32), `fromCurve` (:53), `sign` (:141)
