## init-named-coefficients. Name the Weierstrass coefficients in `Init` instead of a reverse-ordered pair

**Priority:** P3
**Status:** open

### Problem

`Init` (`fs/crypto/secp/module.f.ts:26-31`) packs the two Weierstrass
coefficients into a positional pair under the single name `a`:

```ts
export type Init = {
    readonly p: bigint
    readonly a: readonly[bigint, bigint]
    readonly g: readonly[bigint, bigint]
    readonly n: bigint
}
```

`curve` unpacks it as `({ a: [a0, a1] })` (`:67`) and builds the curve
equation (`:79`) as `x³ + a1·x + a0` — so in the standard
`y² = x³ + a·x + b` notation the field **named `a`** stores **`[b, a]`**:
constant term first, linear coefficient second. The ordering is confusing
enough that every non-trivial curve literal needs prose comments to decode
it (`secp256r1` `:189-190`, `secp384r1` `:205-206`, `secp521r1` `:221-222`):

```ts
a: [
    0x5ac635d8_..._27d2604bn, //< b
    0xffffffff_..._fffffffcn, //< a
],
```

while `secp256k1` (`a: [7n, 0n]`, `:174`) gives the reader no clue which
slot is which. The `y2` doc comment (`:77`) even misstates the equation as
`y**2 = a1*x**3 + a0`. Separately, `Init.g` is a curve point but re-spells
an anonymous `readonly[bigint, bigint]` instead of the exported `Point2D`
(`:15`), which is part of why the `a` pair is easy to misread — the same
anonymous tuple type stands for both "a point" and "two unrelated field
constants".

### Proposal

Split the pair into named fields and reuse `Point2D` — the destructuring
then documents itself and the `//< b` / `//< a` comments disappear:

```ts
export type Init = {
    readonly p: bigint
    /** The linear coefficient in `y² = x³ + a·x + b`. */
    readonly a: bigint
    /** The constant term in `y² = x³ + a·x + b`. */
    readonly b: bigint
    readonly g: Point2D
    readonly n: bigint
}

export const curve = ({ p, a, b, n, g }: Init): Curve => {
    ...
    const y2 = (x: bigint) => addB(add(pow3(x))(mulA(x)))
```

(`addA1`/`mulA1`/`addA0` rename to `addA`/`mulA`/`addB`; fix the `y2` doc
comment to `y² = x³ + a·x + b`.) Update the five curve literals in
`fs/crypto/secp/module.f.ts` and the `example` init in
`fs/crypto/secp/proof.f.ts:59-64`. This is a breaking change to an exported
type — update every importer in the same PR per AGENTS.md; `curve`'s
behavior and all curve constants are unchanged.

### Tasks

- [ ] Reshape `Init` (`a: bigint`, `b: bigint`, `g: Point2D`); update
      `curve`'s destructure, the partials' names, and the `y2` doc comment.
- [ ] Update the four curve literals and the proof's `example`; delete the
      `//< a` / `//< b` comments.
- [ ] `npx tsc` clean; `fjs t` passes (secp/sign proofs); CHANGELOG entry
      marked **BREAKING CHANGES** if `Init`'s shape is consumed outside the
      repo.

### Related

- `fs/crypto/secp/module.f.ts:15` (`Point2D`), `:26-31` (`Init`), `:67-79`
  (`curve`/`y2`), `:170-225` (curve literals).
- `fs/crypto/todo/666-crypto-sign-fromcurve.md` — reshapes the
  `sign`→`curve` boundary; independent of this record cleanup, but land
  whichever goes first and rebase the other.
