# 66D-bigint-roundup-factory. `bigint`: collapse the power-of-two `divUpE2` / `roundUpE2` variants

**Priority:** P4
**Status:** done

## Problem

`fs/types/bigint/module.f.ts` carries two parallel families of "divide / round
up" helpers:

```ts
// general integer divisor
export const divUp = (b: bigint): Unary => {
    const m = b - 1n
    return v => (v + m) / b
}
export const roundUp = (b: bigint): Unary => {
    const d = divUp(b)
    return v => d(v) * b
}

// power-of-two divisor, shift-based (:269, :280)
export const divUpE2 = (e: bigint): Unary => {
    const m = mask(e)
    return v => (v + m) >> e
}
export const roundUpE2 = (e: bigint): Unary => {
    const d = divUpE2(e)
    return v => d(v) << e
}

// :288, :293
export const divUp8: Unary = divUpE2(3n)
export const roundUp8: Unary = roundUpE2(3n)
```

The original framing of this issue was to *share* the `roundUp` / `roundUpE2`
compose-skeleton (build the divider, then scale back up). On closer inspection
the right move is the opposite: the `E2` family should not exist at all, so there
is nothing to share.

### The `E2` generality is unused

Tracing every consumer:

- `divUpE2` / `roundUpE2` are imported **only** by `fs/types/bigint/proof.f.ts`.
  No module uses them at any exponent other than `3n`; their sole non-test role is
  to build `divUp8` / `roundUp8`.
- `divUp8` / `roundUp8` are the real shipping helpers — `fs/asn.1`
  (`divUp8(bitLength(tag))`, `divUp8(length)`) and `fs/crypto/sign`
  (`divUp8(hf.hashLength)`, `roundUp8(qlen)`). Every input is a small,
  non-negative bit/byte count (tens to a few hundred bits), computed once per
  encode / sign — never a hot loop over large bigints.
- The only large-bigint consumer of the *general* divider, `fs/types/bit_vec`
  (`divUp(n << 1n)`), divides by `2·n` — **not** a power of two — so it genuinely
  needs `divUp` and could not use a shift variant anyway.

So the entire `E2` family exists to express one thing: "divide by `8`."

### The performance rationale does not hold up

The implicit justification for a shift-based variant is speed: `>> e` is cheaper
than `/ 2^e`. Two facts undercut it as a *current* concern:

1. **The engine will not collapse it for you — but nobody needs it to.** BigInt
   is not JIT-specialised to operand values; `x / 8n` dispatches to general
   arbitrary-precision division because the divisor is a runtime heap value, not a
   literal the engine can prove is a power of two (V8's BigInt division has no
   power-of-two fast path). So `>> 3n` really is the cheaper instruction. But at
   the actual call sites — single-/double-digit bigints, called O(once) — the
   difference is a handful of nanoseconds, invisible.
2. **No benchmark, no hot path.** Optimising a cold path over small operands with
   a second operation family, an extra exported pair, and a less direct API
   (`divUpE2(3n)` vs `divUp(8n)`) is premature by definition.

## Proposal

Drop `divUpE2` / `roundUpE2` and derive the byte-count helpers from the general
divider:

```ts
/** Converts a bit count to a byte count, rounding up (divide by 8). */
export const divUp8: Unary = divUp(8n)
/** Rounds a bit count up to a whole number of bytes (multiple of 8). */
export const roundUp8: Unary = roundUp(8n)
```

`mask` stays — it is exported and used elsewhere (`fs/types/bit_vec` imports it);
only the two `E2` wrappers go.

### Equivalence and the one caveat to record

For **non-negative** `v`, `divUpE2(3n)(v)` and `divUp(8n)(v)` are identical:
`(v + 7) >> 3` equals `(v + 7) / 8` because flooring a non-negative bigint by a
positive divisor matches the arithmetic right shift. They diverge only for
**negative** `v` (`>>` floors toward −∞; `/` truncates toward zero). Every real
input here is a non-negative bit/byte count, so the swap is behaviour-preserving
— but the JSDoc on `divUp8` / `roundUp8` should state the non-negative domain so
the floor-vs-truncate distinction is recorded at the canonical site.

If a future hot path over *large* bigints needs power-of-two division, reintroduce
a shift variant then, backed by a benchmark — `AGENTS.md`: "Don't implement a
helper that no existing module uses … Speculative code rots."

## Tasks

- [x] Redefine `divUp8` / `roundUp8` in terms of `divUp` / `roundUp`; delete
      `divUpE2` / `roundUpE2`.
- [x] Add JSDoc noting the bits→bytes intent and the non-negative-input domain.
- [x] Drop the `divUpE2` / `roundUpE2` cases from `fs/types/bigint/proof.f.ts`;
      keep full line/branch coverage of `divUp` / `roundUp` / `divUp8` / `roundUp8`.
- [x] Run `npx tsc` and `fjs t`; confirm `bigint`, `asn.1`, and `crypto/sign`
      proofs still pass (call-site behaviour is unchanged on the non-negative
      domain).

## Related

- [i66A-divup8-bits-to-bytes](./66A-divup8-bits-to-bytes.md) — landed the shared
  `divUp8` / `roundUp8` exports (then defined via `divUpE2(3n)`); this issue
  removes the now-redundant `E2` layer underneath them.
- [i113-bigint-bitlen-proposal](./113-bigint-bitlen-proposal.md) — adjacent
  bit-length work; `bitLength` is the input these `divUp8` calls consume.
