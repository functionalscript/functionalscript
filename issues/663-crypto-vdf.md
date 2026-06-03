# 663-crypto-vdf. Sloth VDF module under `fs/crypto/vdf`

**Priority:** P3
**Status:** open

## Problem

There is no verifiable delay function (VDF) support under
[`fs/crypto/`](../fs/crypto/README.md). Sloth is a simple, auditable VDF
(permutation over a fixed safe prime) used in delay-based protocols — see the
VDF discussion in [i052-poker](./052-poker.md). Without a shared module,
callers would copy imperative JavaScript (mutable loops, `**` exponentiation)
that does not match FunctionalScript's purely functional style or existing
`prime_field` / `bigint` conventions.

## Proposal

Add `fs/crypto/vdf/` implementing the **Sloth** VDF from
[hyperhyperspace/pulsar `SlothVDF.ts`](https://github.com/hyperhyperspace/pulsar/blob/main/src/model/SlothVDF.ts),
adapted from the reference JavaScript in
[dignity.js `sloth-vdf.js`](https://github.com/jose-compu/dignity.js/blob/main/src/security/sloth-vdf.js)
and [`vdf.js`](https://github.com/jose-compu/dignity.js/blob/main/src/security/vdf.js).

### Cryptographic core

Fixed safe prime (3072-bit), same constant as the reference:

```ts
export const p = 170082004324204494273811327264862981553264701145937538369570764779791492622392118654022654452947093285873855529044371650895045691292912712699015605832276411308653107069798639938826015099738961427172366594187783204437869906954750443653318078358839409699824714551430573905637228307966826784684174483831608534979n
```

Operations (all mod `p`, inputs normalized with `% p`):

| Function | Role |
|----------|------|
| `quadRes(x)` | Euler criterion: `x^((p-1)/2) === 1` |
| `modSqrt(x)` | `(p+1)/4` Tonelli–Shanks shortcut (prime ≡ 3 mod 4); if `x` is non-residue, negate `x` mod `p` first |
| `eval(steps)(x)` | Apply `modSqrt` exactly `steps` times — **slow** (sequential by design) |
| `verify(steps)(x)(y)` | Square `y` mod `p` exactly `steps` times; compare to `x` or `-x mod p` after optional negation if non-residue |

Public API names should read as FunctionalScript values (`eval`, `verify`), not
`generateProofVDF` / `verifyProofVDF` from the reference.

### API sketch

Home: `fs/crypto/vdf/module.f.ts`.

```ts
export type Sloth = {
  readonly p: bigint
  readonly quadRes: (x: bigint) => boolean
  readonly modSqrt: (x: bigint) => bigint
  /** Sequential Sloth permutation — intentionally O(steps). */
  readonly eval: (steps: bigint) => (x: bigint) => bigint
  /** Fast verification of `eval(steps)(x)`. */
  readonly verify: (steps: bigint) => (x: bigint) => (y: bigint) => boolean
}

export const sloth: Sloth
```

Hex string wrappers (`challengeHex`, `resultHex`) from dignity.js belong in a
**separate optional layer or caller code**, not in the core module: core API
works on `bigint` like [`fs/types/prime_field/`](../fs/types/prime_field/module.f.ts).

### Implementation notes

- **Reuse `prime_field(p)`** where it fits (`mul`, `neg`, `pow`, `sub`). Sloth's
  `modSqrt` and the verify-path squaring loop are Sloth-specific — keep them in
  `vdf/module.f.ts` rather than extending `prime_field`.
- **Exponentiation:** prefer `PrimeField.pow` over raw `**` (reference uses both
  `fastPow` and `value ** BigInt(2)`).
- **Iteration:** `eval`/`verify` require `steps` sequential modular ops; express
  loops with the same patterns as [`prime_field` reciprocal](../fs/types/prime_field/module.f.ts)
  or `repeat` from `monoid` where readable. Avoid `let` mutation in exported
  surface helpers when a functional fold is clear.
- **Edge cases:** document behaviour for `steps === 0n` (`eval` returns `x % p`;
  `verify` checks `y` against `x` / `-x`). Reject negative `steps`.
- Do **not** port the reference's `class SlothPermutation` or CommonJS exports.

### Module layout

| File | Role |
|------|------|
| `fs/crypto/vdf/module.f.ts` | `Sloth` type, constant `p`, `sloth` |
| `fs/crypto/vdf/proof.f.ts` | Cross-check vectors against reference JS (fixed `x`, `steps`, `y`) |
| `fs/crypto/vdf/README.md` | Sloth overview, prime source, eval vs verify cost |

Register `./fs/crypto/vdf/module.f.ts` in `deno.json` `exports`. Update
[`fs/crypto/README.md`](../fs/crypto/README.md) to list `vdf`.

### Test vectors

Capture at least one `(x, steps, y)` triple by running the dignity.js reference
(or pulsar) and assert `sloth.eval(steps)(x) === y` and
`sloth.verify(steps)(x)(y) === true` in `proof.f.ts`. Include a negative case
(wrong `y`).

## Tasks

- [ ] Add `fs/crypto/vdf/module.f.ts` with `p`, `sloth.eval`, `sloth.verify`.
- [ ] Wire modular arithmetic through `prime_field(p)` where appropriate.
- [ ] Add `proof.f.ts` with reference-derived vectors and a failure case.
- [ ] Register export in `deno.json`; extend `fs/crypto/README.md`.
- [ ] Run `npx tsc`, `npm run fst` in `fs/crypto/vdf/`, and `npm run update`.

## Related

- [i052-poker](./052-poker.md) — protocol sketch using VDF for delayed key reveal.
- [`fs/types/prime_field/`](../fs/types/prime_field/module.f.ts) — modular `pow` / `mul` / `neg`.
- [`fs/crypto/sha2/`](../fs/crypto/sha2/module.f.ts) — sibling crypto module layout.

## References

- Reference implementation: [dignity.js `sloth-vdf.js`](https://github.com/jose-compu/dignity.js/blob/main/src/security/sloth-vdf.js), [`vdf.js`](https://github.com/jose-compu/dignity.js/blob/main/src/security/vdf.js)
- Original adaptation source: [hyperhyperspace/pulsar `SlothVDF.ts`](https://github.com/hyperhyperspace/pulsar/blob/main/src/model/SlothVDF.ts)
- Sloth VDF paper context: [Boneh et al., verifiable delay functions](https://eprint.iacr.org/2018/623)
- Existing crypto tree: [fs/crypto](https://github.com/functionalscript/functionalscript/tree/main/fs/crypto)
