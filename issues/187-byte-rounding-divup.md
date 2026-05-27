# 187. byte-rounding: reuse `bigint.divUp`/`roundUp` in `asn.1`, and fix their type

`bigint` already exports the "round up to a multiple" arithmetic:

```ts
// fs/types/bigint/module.f.ts:272
export const divUp: Reduce = b => {
    const m = b - 1n
    return v => (v + m) / b
}

export const roundUp: Reduce = b => {
    const d = divUp(b)
    return v => d(v) * b
}
```

`asn.1` re-derives "round a bit-length up to a whole number of bytes" twice
instead of using them:

```ts
// fs/asn.1/module.f.ts:71  — tag length
vec(max((bitLength(tag) + 7n) >> 3n)(1n) << 3n)(tag)

// fs/asn.1/module.f.ts:133
const round8 = ({ length, uint }: Unpacked): Round8 => {
    const byteLen = (length + 7n) >> 3n        // === divUp(8n)(length)
    return { byteLen, v: vec(byteLen << 3n)(uint) }   // byteLen << 3n === roundUp(8n)(length)
}
```

`(x + 7n) >> 3n` is exactly `divUp(8n)(x)`, and `byteLen << 3n` is the bit-count
`roundUp(8n)(x)`. `asn.1` already imports `bitLength`/`max` from `bigint`
(`asn.1/module.f.ts:7`), so the dependency is established.

## Two coupled changes

**(1) Reuse.** Bind `const divUp8 = divUp(8n)` (and `roundUp8 = roundUp(8n)`) and
use them in `round8` and `tagEncode`, keeping the byte-rounding arithmetic in one
place. The `max(...)(1n)` "at least one byte" floor stays local to `tagEncode`.

**(2) Honest type.** `divUp`/`roundUp` are currently typed `Reduce`
(`= Fold<bigint, bigint> = (a) => (b) => bigint`), the type meant for
*associative reductions over a list* (what `sum`/`product` feed to `reduce`). But
these are **not** reductions: the first parameter is a *fixed divisor*
(configuration), the second is the operand. Their real consumers confirm it —
`fs/crypto/sign/module.f.ts:14` binds `roundUp(8n)`/`divUp(8n)` as `Unary`
operations, and the `asn.1` use above is the same `divUp(8n)` partial application.
Retype them to advertise the config/operand split:

```ts
export const divUp = (b: bigint): Unary => { const m = b - 1n; return v => (v + m) / b }
export const roundUp = (b: bigint): Unary => { const d = divUp(b); return v => d(v) * b }
```

(`Unary = OpUnary<bigint, bigint>` is already imported at `bigint/module.f.ts:28`.)
This prevents `reduce(divUp)` from silently type-checking into nonsense. `xor`
stays a genuine `Reduce`.

## Why this qualifies

- DRY: `divUp(8n)`/`roundUp(8n)` is the same byte-rounding used by `sign` and now
  `asn.1` (two distinct modules) — extract/reuse, don't re-derive.
- Clarity/type-honesty: naming the curried first parameter as configuration
  (`(divisor) => Unary`) rather than a fold accumulator documents the shape and
  removes a latent misuse.

## Caveats

- The runtime behavior and curried shape are unchanged by the retype; only the
  declared type alias changes. The `Reduce` import in `bigint` is still used by
  `addition`/`xor`/etc.
- Confirm no caller currently relies on `divUp`/`roundUp` being assignable to
  `Reduce` (none should — `sign` already treats them as `Unary`).

## Related

- [i164](./README.md) — same "config vs data parameter" theme; that issue
  uncurries *data* parameters, whereas here the curried first arg is legitimately
  config and only the type label is wrong.
