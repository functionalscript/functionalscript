## rounded-magnitude. `decToBin` restates `tryDecToFormat`'s pipeline

**Priority:** P4
**Status:** open

### Problem

The trickiest arithmetic in the module — scale, round exactly once,
renormalize — is stated twice in `module.f.mjs`:

```js
// :155-162
export const decToBin = ([dm, de]) => {
    if (dm === 0n) { return [0n, 0] }
    const { precision } = binary64
    return withSign(dm, de)(magnitude =>
        renormalize(precision)(round(1)(scale(precision)(magnitude))))
}
// :186-197
export const tryDecToFormat = ({ precision, minExp, maxExp }) => ([dm, de]) => {
    if (dm === 0n) { return [0n, 0] }
    const scaled = scale(precision)([abs(dm), de])
    const [, e] = scaled[0]
    const [m, resultE] = renormalize(precision)(round(Math.max(minExp - e, 1))(scaled))
    if (bitLength(m) + BigInt(resultE) > BigInt(precision + maxExp)) { return null }
    return m === 0n ? [0n, 0] : multiply([m, resultE])(BigInt(sign(dm)))
}
```

Three things are written twice: the `dm === 0n → [0n, 0]` prologue, the
`renormalize ∘ round ∘ scale` pipeline, and the sign restore — which is
worse than duplication, because `withSign` exists precisely to state
"operations on signed mantissas factor through the magnitude", and
`tryDecToFormat` open-codes it (`abs(dm)` in, `multiply(…)(BigInt(sign(dm)))`
out) since it needs the intermediate `e` to pick the rounding grid.
`decToBin` is the instance `k = 1` of the same pipeline: for any `minExp`
at or below `e + 1`, `Math.max(minExp - e, 1)` is `1`. Both doc blocks
carry the round-exactly-once argument; a change to it has to land in two
bodies the type checker will not keep in sync.

### Proposal

Extract one private magnitude pipeline —
`roundedMagnitude = precision => minExp => ([dm, de]) => …` doing
scale → pick `k` → round → renormalize — behind one sign/zero wrapper (a
generalized `withSign`) that owns **both** zero cases: the `dm === 0n`
early return on the way in, and the canonical `[0n, 0]` for a nonzero
input that rounds to zero on the way out — today's post-rounding
`m === 0n` branch in `tryDecToFormat`, which the proof pins for both
signs (`[1n, -1200]` and `[-1n, -1200]` are `[0n, 0]`). A rounded zero
must never leave the wrapper carrying the rounding exponent.
`tryDecToFormat` then adds only the `maxExp` overflow guard; `decToBin`
becomes the helper at `binary64.precision` with an unbounded `minExp`
(`-Infinity`, which `Math.max` absorbs). One body, one place for the
rounding argument, one place for canonical zero.

### Tasks

- [ ] Extract the pipeline and the zero-canonicalizing wrapper;
      re-express both exports; proofs pass unchanged, the underflow rows
      included.
- [ ] `tsc`, `fjs test`.

### Related

- [from-decimal.md](./from-decimal.md) — the input-side owner (decimal
  digits → `BigFloat`); this issue is the conversion side.
