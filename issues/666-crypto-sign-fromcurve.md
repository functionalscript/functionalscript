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

   Rather than just swapping `all(q)` for `fromCurve(c)` and *still* hand-pulling
   the curve pieces, give `fromCurve` a **composite** result that holds the
   `q`-only RFC6979 helpers as a named field alongside the curve-derived inputs
   `sign` uses. Per review, prefer **composition over intersection/deriving** (no
   `&`) and embed the RFC6979 record as a field. Note `sign` reaches into the curve
   for three things — `div` via `nf` (`:186`), `g` (`:172`), and `mul` (`:172`,
   `c.mul(k)(g)`):

   ```ts
   export type Signer = {
       readonly rfc6979: Rfc6979   // the q-only conversions — was `All`
       readonly nf: Curve['nf']    // gives div, and q via nf.p
       readonly mul: Curve['mul']
       readonly g: Curve['g']
   }
   export const fromCurve = (c: Curve): Signer =>
       ({ rfc6979: all(c.nf.p), nf: c.nf, mul: c.mul, g: c.g })
   ```

   (Review also noted `All` deserves a clearer name. Renaming `All` → `Rfc6979`
   and using that as the field type is suggested; the rename is optional polish and
   can be split out if it churns proofs/imports.)

   Then `sign` reads from `fromCurve(c)` and passes the embedded record straight to
   `computeK`:

   ```ts
   const { rfc6979, nf: { div }, mul, g } = fromCurve(c)
   const { q, bits2int } = rfc6979
   ...
   const k = computeK(rfc6979)(hf)(x)(m)   // computeK keeps taking the RFC6979 record unchanged
   const rxy = mul(k)(g)
   ```

   ### Why composition (and why the curve pieces don't go on the RFC6979 record)

   Composition keeps the RFC6979 record **completely unchanged**, which matters
   because it is constructed and consumed on its own, with no curve in sight:

   - **`all` is called with a bare subgroup order.** `all(q: bigint)` derives the
     RFC6979 helpers from `q` alone, and is invoked that way both conceptually and
     in practice — e.g. `fs/crypto/sign/proof.f.ts` has `all(7n)`, `all(17n)`,
     `all(5n)`, `all(11n)`, `all(q)`. None of those callers has an `nf`/`g`/`mul`
     to supply. So the curve pieces live on `Signer`, not on the RFC6979 record.
   - **`mul` isn't on `nf` anyway.** `mul` is a field of `Curve`
     (`fs/crypto/secp/module.f.ts:44`, `mul: Fold<bigint, Point>`), not of the
     prime field `nf` — so `nf` + `g` alone wouldn't cover `sign`'s `c.mul(k)(g)`.

   `Signer` is therefore a plain record composing the unchanged RFC6979 helpers
   with `nf`/`mul`/`g`, and `computeK` continues to take just the RFC6979 record.

2. Add a named `bits2intModQ: (b: Vec) => bigint` to the RFC6979 record
   (`= b => bits2int(b) % q`), define `bits2octets = b => int2octets(bits2intModQ(b))`
   in terms of it, and use `rfc6979.bits2intModQ(hm)` in `sign`. The single comment
   about the conditional-subtraction reduction then has one home.

Part 1 is the separation-of-concerns fix: `fromCurve` already exists but is both
bypassed by `sign` and too thin to fully serve it; part 2 is a small DRY win
co-locating the RFC rationale.

## Tasks

- [ ] `fromCurve` returns a composite `Signer = { rfc6979, nf, mul, g }` (no `&`);
      `all` stays the unchanged `q`-only RFC6979 factory `computeK` uses
- [ ] `sign` reads only from `fromCurve(c)` — no direct `c.nf`/`c.mul`/`c.g` access
- [ ] add `bits2intModQ` to the RFC6979 record; express `bits2octets` and `sign`'s `h` through it
- [ ] (optional) rename `All` → `Rfc6979` for clarity; split out if it churns proofs/imports
- [ ] confirm `proof.f.ts` still covers all of `all`/`fromCurve`/`sign`

## Related

- `fs/crypto/sign/module.f.ts` — `all` (:32), `fromCurve` (:53), `sign` (:141)
