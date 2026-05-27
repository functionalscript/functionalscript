# 187. byte-rounding: a shift-based `divUpE2`/`roundUpE2`, reused by `asn.1` and `sign`

`bigint` exports general round-up arithmetic that divides/multiplies:

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

`asn.1` re-derives "round a bit-length up to whole bytes" twice — but with **bit
shifts**, not division, because the divisor is a power of two (8 = 2³):

```ts
// fs/asn.1/module.f.ts:71  — tag length
vec(max((bitLength(tag) + 7n) >> 3n)(1n) << 3n)(tag)

// fs/asn.1/module.f.ts:133
const round8 = ({ length, uint }: Unpacked): Round8 => {
    const byteLen = (length + 7n) >> 3n               // divide-up by 8 via shift
    return { byteLen, v: vec(byteLen << 3n)(uint) }   // ×8 via shift
}
```

## Performance: don't trade a shift for a division

Naively reusing `divUp(8n)` would replace `(x + 7n) >> 3n` (a shift) with
`(x + 7n) / 8n` (a general bigint division) — a needless slowdown for a
power-of-two divisor. So the right shared helper is a **shift-based, power-of-two**
variant parameterized by the exponent `e` (divisor = 2ᵉ), as the review suggests
(`divUpE2`):

```ts
// fs/types/bigint  (reuses the existing `mask`, :206)
export const divUpE2 = (e: bigint): Unary => {
    const m = mask(e)            // (1n << e) - 1n
    return v => (v + m) >> e
}

export const roundUpE2 = (e: bigint): Unary => {
    const d = divUpE2(e)
    return v => d(v) << e
}
```

These compile to the same shifts the hand-written `asn.1` code already uses, so
there is no regression.

The curried `(e) => (v) =>` shape is deliberate for caching: `mask(e)` is computed
once when the divisor/exponent is fixed and captured in the returned closure, so
the per-operand path is just `(v + m) >> e` with no recomputation. (The general
`divUp` caches `b - 1n` the same way, and consumers already bind the partial
application once — e.g. `const divUp8 = divUp(8n)`.)

## Consumers

- **`asn.1`**: `byteLen = divUpE2(3n)(length)`, and the rounded bit length is
  `byteLen << 3n` (i.e. `roundUpE2(3n)(length)`); `tagEncode` keeps its
  `max(...)(1n)` "≥ 1 byte" floor between the divide-up and the `<< 3n`. `asn.1`
  already imports `bitLength`/`max` from `bigint` (`asn.1:7`), so the dependency
  is established.
- **`crypto/sign`**: `divUp(8n)`/`roundUp(8n)` (`sign/module.f.ts:14,16`) are also
  power-of-two (8 = 2³); migrating them to `divUpE2(3n)`/`roundUpE2(3n)` makes
  `divUpE2` a genuine second consumer **and** swaps their general `/`/`*` for
  shifts — a speedup for `sign` too.

## Keep the general `divUp`/`roundUp` — and fix their type

The general versions must stay: `bit_vec` uses `divUp(n << 1n)`
(`bit_vec/module.f.ts:394`), whose divisor `2·n` is **not** a static power of two,
so it genuinely needs the `/`-based form.

While there, fix their type. `divUp`/`roundUp` are typed `Reduce`
(`= Fold<bigint, bigint> = (a) => (b) => bigint`), the type for *associative
reductions over a list* (what `sum`/`product` feed to `reduce`). But these are
**not** reductions: the first parameter is a fixed *divisor* (configuration), the
second the operand — `sign` already treats `divUp(8n)`/`roundUp(8n)` as `Unary`.
Retype to advertise the config/operand split (matching `divUpE2` above):

```ts
export const divUp = (b: bigint): Unary => { const m = b - 1n; return v => (v + m) / b }
export const roundUp = (b: bigint): Unary => { const d = divUp(b); return v => d(v) * b }
```

(`Unary = OpUnary<bigint, bigint>` is already imported at `bigint:28`.) This
prevents `reduce(divUp)` from silently type-checking into nonsense. `xor` stays a
genuine `Reduce`.

## Why this qualifies

- DRY with two real consumers of power-of-two byte rounding (`asn.1`, `sign`) —
  past the second-consumer bar — without forcing a slower general division on
  either.
- Clarity/type-honesty: `(exponent) => Unary` / `(divisor) => Unary` document that
  the curried first parameter is configuration, not a fold accumulator.

## Caveats

- `divUpE2`/`roundUpE2` are valid **only** for power-of-two divisors; keep
  `bit_vec`'s `divUp(n << 1n)` on the general form (its divisor isn't a static
  power of two).
- Behavior is identical to the existing `asn.1` shifts; confirm with the `asn.1`
  tests. The `sign` migration is also behavior-preserving (8 = 2³).
- The retype of `divUp`/`roundUp` changes only the declared type, not the runtime
  shape; the `Reduce` import in `bigint` is still used by `addition`/`xor`/etc.

## Related

- [i164](./README.md) — same "config vs data parameter" theme; that issue
  uncurries *data* parameters, whereas here the curried first arg is legitimately
  config and only the type label is wrong.
