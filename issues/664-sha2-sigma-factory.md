# 664-sha2-sigma-factory. `crypto/sha2`: collapse the `bigSigma`/`smallSigma` rotation mirror

**Priority:** P4
**Status:** done

## Problem

`fs/crypto/sha2/module.f.ts` defines two sigma mixers inside `base`
(`fs/crypto/sha2/module.f.ts:77-96`). They are byte-identical except for
their third XOR operand:

```ts
const bigSigma = ([a, b, c]: V3) => {
    const ra = rotr(a)
    const rb = rotr(b)
    const rc = rotr(c)
    return (x: bigint) => ra(x) ^ rb(x) ^ rc(x)
}

const bigSigma0 = bigSigma(bs0)
const bigSigma1 = bigSigma(bs1)

const smallSigma = ([a, b, c]: V3) => {
    const ra = rotr(a)
    const rb = rotr(b)
    return (x: bigint) => ra(x) ^ rb(x) ^ (x >> c)
}

const smallSigma0 = smallSigma(ss0)
const smallSigma1 = smallSigma(ss1)
```

The shared structure — precompute `rotr(a)` and `rotr(b)`, precompute a
third operand from `c`, then XOR the three together — is the whole body
of each function. The only difference is whether the third operand is
`rotr(c)` (big sigma) or `>> c` (small sigma). This is the SHA-2
σ/Σ algebra; both forms have two real consumers each (`*0` and `*1`),
so the second-consumer bar is well past.

## Proposed abstraction

A single sigma factory parameterized by how the *third* operand is built
from `c`. Keeping the third operand as a `c => x => …` function preserves
the existing precomputation (the `rotr(c)` / shift-by-`c` closure is built
once per sigma, not once per `x`):

```ts
const sigma =
    (third: (c: bigint) => (x: bigint) => bigint) =>
    ([a, b, c]: V3) => {
        const ra = rotr(a)
        const rb = rotr(b)
        const rc = third(c)
        return (x: bigint) => ra(x) ^ rb(x) ^ rc(x)
    }

const bigSigma = sigma(rotr)            // third operand: rotate right by c
const smallSigma = sigma(c => x => x >> c) // third operand: shift right by c
```

`bigSigma0`/`bigSigma1`/`smallSigma0`/`smallSigma1` are unchanged below
this point. `rotr` already has exactly the `c => x => …` shape, so
`sigma(rotr)` reads directly as "the big sigma is the small sigma whose
tail is another rotation."

## Why this qualifies

- **DRY:** the rotation-setup-plus-XOR body is duplicated verbatim; only
  one sub-expression differs. AGENTS.md calls out exactly this case —
  "two or more modules [here, two helpers in one module] share an
  algorithm and differ only in … small helpers."
- **Readability:** names the relationship between the two SHA-2 mixers
  instead of forcing the reader to diff two near-identical blocks (an
  explicit goal in AGENTS.md's "two code branches share most of their
  structure" guidance).
- **No performance regression:** the `c`-derived operand is still
  computed once when the sigma is specialized (`third(c)`), not per call.

## Caveats

- This is a small, local cleanup (≈ 8 lines saved). It does not change
  any exported API — `bigSigma*`/`smallSigma*` keep their signatures —
  and the SHA-256/512 test vectors in `proof.f.ts` must still pass
  unchanged.
- `ch`/`maj` (`fs/crypto/sha2/module.f.ts:98-100`) are *not* part of this
  mirror; they have distinct structure and should be left alone.

## Related

- [i187](./187-byte-rounding-divup.md) — another `crypto`-area
  micro-DRY (shift-based byte rounding shared by `asn.1`/`sign`).
