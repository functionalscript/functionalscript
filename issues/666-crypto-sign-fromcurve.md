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
   swapping `all(q)` for `fromCurve(c)` and *still* hand-pulling the curve pieces,
   extend `fromCurve`'s **result type** to bundle the curve-derived inputs `sign`
   uses. Per the review's preference, expose the whole `nf` (which carries `div`
   and `p` = `q`) rather than just `div`. Note `sign` reaches into the curve for
   three things — `div` via `nf` (`:186`), `g` (`:172`), and `mul` (`:172`,
   `c.mul(k)(g)`):

   ```ts
   export type Signer = All & {
       readonly nf: Curve['nf']    // gives div, and q via nf.p
       readonly mul: Curve['mul']
       readonly g: Curve['g']
   }
   export const fromCurve = (c: Curve): Signer =>
       ({ ...all(c.nf.p), nf: c.nf, mul: c.mul, g: c.g })
   ```

   Then `sign` destructures solely from `fromCurve(c)`:

   ```ts
   const a = fromCurve(c)
   const { q, bits2int, nf: { div }, mul, g } = a
   ...
   const k = computeK(a)(hf)(x)(m)   // Signer extends All, so this still type-checks
   const rxy = mul(k)(g)
   ```

   ### Why these go on `Signer` (fromCurve's type), not on `All` itself

   Review asked whether `nf`/`g` can live on `All` directly. They can't, cleanly,
   for two reasons:

   - **`all` is called with a bare subgroup order, no curve.** `all(q: bigint)`
     derives the RFC6979 helpers from `q` alone, and is invoked that way both
     conceptually and in practice — e.g. `fs/crypto/sign/proof.f.ts` has `all(7n)`,
     `all(17n)`, `all(5n)`, `all(11n)`, `all(q)`. None of those callers has an `nf`
     or `g` to supply. Putting `nf`/`g` on `All` would force every bare `all(q)`
     site to invent curve data it doesn't have (or make the fields nullable, which
     just pushes `undefined` onto `sign`).
   - **`mul` isn't on `nf` anyway.** `mul` is a field of `Curve`
     (`fs/crypto/secp/module.f.ts:44`, `mul: Fold<bigint, Point>`), not of the
     prime field `nf`. So `nf` + `g` alone still wouldn't cover `sign`'s
     `c.mul(k)(g)`; the enriched context must add `mul` too.

   So `All` stays the pure `q`-only RFC6979 factory `computeK` consumes, and
   `Signer = All & { nf, mul, g }` is the curve-aware superset `fromCurve` returns.
   This answers the review affirmatively in spirit (`fromCurve` *should* carry the
   curve pieces) while keeping them off the bare-`q` `All` type.

2. Add a named `bits2intModQ: (b: Vec) => bigint` to the `All` record
   (`= b => bits2int(b) % q`), define `bits2octets = b => int2octets(bits2intModQ(b))`
   in terms of it, and use `a.bits2intModQ(hm)` in `sign`. The single comment about
   the conditional-subtraction reduction then has one home.

Part 1 is the separation-of-concerns fix: `fromCurve` already exists but is both
bypassed by `sign` and too thin to fully serve it; part 2 is a small DRY win
co-locating the RFC rationale.

## Tasks

- [ ] extend `fromCurve` to return a `Signer` (`All` + `nf`/`mul`/`g`); keep `all`
      as the pure `q`-only `All` factory `computeK` uses
- [ ] `sign` destructures only from `fromCurve(c)` — no direct `c.nf`/`c.mul`/`c.g` access
- [ ] add `bits2intModQ` to `All`; express `bits2octets` and `sign`'s `h` through it
- [ ] confirm `proof.f.ts` still covers all of `all`/`fromCurve`/`sign`

## Related

- `fs/crypto/sign/module.f.ts` — `all` (:32), `fromCurve` (:53), `sign` (:141)
