# 191. `bigfloat`: a `withSign` helper for "operate on the magnitude, restore the sign"

**Priority:** P3
**Status:** done

Two private `bigfloat` functions strip the sign off a mantissa, do unsigned work,
then re-apply the sign with `multiply(...)(s)`:

```ts
// fs/types/bigfloat/module.f.ts:55  — round53
const round53 = ([[m, e], r]: BigFloatWithRemainder): BigFloat => {
    const mabs = abs(m)
    const s = BigInt(sign(m))
    const [m54, e54] = decreaseMantissa([mabs, e])(twoPow54)
    /* … unsigned work on mabs/m54 … */
    return multiply([m53 + o54, e53])(s)
}
```

```ts
// fs/types/bigfloat/module.f.ts:78  — decToBin, negative-exponent branch
const p = pow5(-dec[1])
const [m, e] = increaseMantissa(dec)(p * twoPow53)
const mAbs = abs(m)
const s = BigInt(sign(m))
const qr = divide([mAbs, e])(p)
const r53 = round53(qr)
return multiply(r53)(s)
```

The shape `const mAbs = abs(m); const s = BigInt(sign(m)); …; return multiply(…)(s)`
is identical in both. (The same `s = sign(m); m = abs(m); … BigInt(s) * m` idiom
also drives `increaseMantissa`/`decreaseMantissa` at `:19-23`/`:34-38`, though
those are already paired by [i177](./README.md).)

## Proposed abstraction

A private "magnitude in, magnitude out, sign reapplied" combinator:

```ts
const withSign = (m: bigint, e: number) => (f: (magnitude: BigFloat) => BigFloat): BigFloat =>
    multiply(f([abs(m), e]))(BigInt(sign(m)))
```

`decToBin`'s negative branch collapses to
`withSign(m, e)(mag => round53([divide(mag)(p), 0n]))` (modulo the remainder
threading), and `round53` runs its body on the supplied magnitude and lets
`withSign` reapply the sign.

## Why this qualifies

- DRY: two private consumers of the same abs/sign/`multiply` envelope.
- Names a real bigfloat invariant ("operations on signed mantissas factor through
  the magnitude") so future operations don't re-spell it.

## Caveats

- `round53` reads `mabs` again inside its predicate
  (`mabs === m54 >> BigInt(e - e54)`, `:62`), so the wrapper must hand the
  magnitude to `f` (it does: `f` receives `[abs(m), e]` and can read `mag[0]`).
  The cleanest contract is exactly "magnitude in, magnitude out", which both sites
  satisfy.
- `decToBin`'s `>= 0` branch (`:73-76`) passes the already-signed mantissa
  straight into `round53`, so it should *not* be wrapped — only the negative
  branch pre-`abs`es and thus needs `withSign`.
- Distinct from [i177](./README.md): that issue collapses
  `increaseMantissa`/`decreaseMantissa`; this one factors the sign envelope out of
  `round53`/`decToBin`. They compose but are separate edits.

## Related

- [i177](./README.md) — `normalizeMantissa` for the shift-loop pair.
