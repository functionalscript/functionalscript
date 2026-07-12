## init-named-coefficients. Rename `Init.a` so the coefficient pair doesn't collide with Weierstrass `a`

**Priority:** P3
**Status:** open

### Problem

`Init` (`fs/crypto/secp/module.f.ts:26-31`) stores the curve-equation
coefficients as a pair under the name `a`:

```ts
export type Init = {
    readonly p: bigint
    readonly a: readonly[bigint, bigint]
    readonly g: readonly[bigint, bigint]
    readonly n: bigint
}
```

The pair's convention is index = power of `x`: `curve` unpacks
`({ a: [a0, a1] })` (`:67`) and builds the equation (`:79`) as
`x³ + a1·x¹ + a0·x⁰`. The indexed scheme itself is good — the index states
the coefficient's defining property (its power) — but the letter `a` is a
bad fit: in the standard Weierstrass notation `y² = x³ + a·x + b`, `a` is
specifically the *linear* coefficient, so a field named `a` whose slot `a0`
holds Weierstrass `b` invites misreading. That's why every non-trivial curve
literal needs prose comments to decode it (`secp256r1` `:189-190`,
`secp384r1` `:205-206`, `secp521r1` `:221-222`):

```ts
a: [
    0x5ac635d8_..._27d2604bn, //< b
    0xffffffff_..._fffffffcn, //< a
],
```

while `secp192r1` (`:139-142`) and `secp256k1` (`a: [7n, 0n]`, `:174`) have
no comments at all, giving the reader no clue which slot is which.

The `y2` doc comment (`:77`) is also wrong: it says `y**2 = a1*x**3 + a0`
instead of `x³ + a1·x + a0`. Separately, `Init.g` is a curve point but
re-spells an anonymous `readonly[bigint, bigint]` instead of the exported
`Point2D` (`:15`).

### Proposal

Keep the indexed-pair design; replace the letter so it cannot be confused
with Weierstrass `a`. `p` is taken by the prime modulus, so use `c` for
*coefficient*:

```ts
export type Init = {
    readonly p: bigint
    /**
     * The non-cubic coefficients of the curve equation
     * `y² = x³ + c[1]·x + c[0]` — index = power of `x`.
     */
    readonly c: readonly [bigint, bigint]
    readonly g: Point2D
    readonly n: bigint
}

export const curve = ({ p, c: [c0, c1], n, g }: Init): Curve => {
    ...
    /** y² = x³ + c1·x + c0 */
    const y2 = (x: bigint) => addC0(add(pow3(x))(mulC1(x)))
```

(`addA1`/`mulA1`/`addA0` rename mechanically to `addC1`/`mulC1`/`addC0`.)
Keep the per-slot comments in the curve literals, reworded to map each slot
to its standard Weierstrass letter — the index-is-power convention says
*where* each coefficient goes, the comment says what the literature calls it:

```ts
c: [
    0x5ac635d8_..._27d2604bn, //< c0 = b
    0xffffffff_..._fffffffcn, //< c1 = a
],
```

and add the same comments to `secp192r1` and `secp256k1`, which have none
today. Update all **five** active curve literals in
`fs/crypto/secp/module.f.ts` (`secp192r1` `:137`, `secp256k1` `:172`,
`secp256r1` `:186`, `secp384r1` `:202`, `secp521r1` `:218`), the
commented-out `secp224r1` block (`:155-170`, so it doesn't rot on the old
shape), and the `example` init in `fs/crypto/secp/proof.f.ts:59-64`. This is
a breaking
change to an exported type — update every importer in the same PR per
AGENTS.md; `curve`'s behavior and all curve constants are unchanged.

### Tasks

- [ ] Rename `Init.a` → `Init.c` with the index-is-power JSDoc; type `g` as
      `Point2D`; rename the partials; fix the `y2` doc comment.
- [ ] Update the five active curve literals, the commented-out `secp224r1`
      block, and the proof's `example`; keep the per-slot comments as
      `//< c0 = b` / `//< c1 = a` (adding them where missing).
- [ ] `npx tsc` clean; `fjs t` passes (secp/sign proofs); CHANGELOG entry
      marked **BREAKING CHANGES** if `Init`'s shape is consumed outside the
      repo.

### Related

- `fs/crypto/secp/module.f.ts:15` (`Point2D`), `:26-31` (`Init`), `:67-79`
  (`curve`/`y2`), `:137-233` (curve literals, including the commented-out
  `secp224r1`).
- `fs/crypto/todo/666-crypto-sign-fromcurve.md` — reshapes the
  `sign`→`curve` boundary; independent of this record cleanup, but land
  whichever goes first and rebase the other.
- PR [#1257 review](https://github.com/functionalscript/functionalscript/pull/1257#discussion_r3558186223)
  — why indexed `c0`/`c1` instead of Weierstrass `a`/`b` names: the index
  states the coefficient's power, and `b, a` field order would misread as
  unordered.
