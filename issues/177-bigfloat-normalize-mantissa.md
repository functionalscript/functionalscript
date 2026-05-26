# 177. `bigfloat`: collapse `increaseMantissa`/`decreaseMantissa` mirror

`fs/types/bigfloat/module.f.ts:15` and `:30` are mirror images of one another.
Both guard the zero mantissa, split off the sign, take the absolute value, then
loop shifting the mantissa one direction while adjusting the exponent, and
restore the sign on return. The only differences are the loop predicate and the
shift direction.

```ts
// :15
const increaseMantissa = ([m, e]: BigFloat) => (min: bigint): BigFloat => {
    if (m === 0n) { return [m, e] }
    const s = sign(m)
    m = abs(m)
    while (true) {
        if (m >= min) { return [BigInt(s) * m, e] }
        m = m << 1n
        e--
    }
}

// :30
const decreaseMantissa = ([m, e]: BigFloat) => (max: bigint): BigFloat => {
    if (m === 0n) { return [m, e] }
    const s = sign(m)
    m = abs(m)
    while (true) {
        if (m < max) { return [BigInt(s) * m, e] }
        m = m >> 1n
        e++
    }
}
```

## Proposed abstraction

A single private factory parameterized by shift direction and stop predicate:

```ts
const normalizeMantissa =
    (shift: (m: bigint) => bigint, de: number, done: (m: bigint, bound: bigint) => boolean) =>
    ([m, e]: BigFloat) => (bound: bigint): BigFloat => {
        if (m === 0n) { return [m, e] }
        const s = sign(m)
        m = abs(m)
        while (true) {
            if (done(m, bound)) { return [BigInt(s) * m, e] }
            m = shift(m)
            e += de
        }
    }

const increaseMantissa = normalizeMantissa(m => m << 1n, -1, (m, min) => m >= min)
const decreaseMantissa = normalizeMantissa(m => m >> 1n, +1, (m, max) => m < max)
```

## Why this qualifies

- Two sites, an exact mirror — the textbook small-helper collapse.
- Both are module-private and each has one caller (`decToBin`/`round53`), so
  this is a self-contained internal cleanup with no API surface change.

## Caveats

- Keep it local to `bigfloat`; there is no external consumer and no reason to
  export it. This is a clarity/DRY tidy, not a new abstraction layer.
- The bodies mutate locals (`m`, `e`) in `let`/loop form, matching the existing
  style of this module; the factory preserves that exact control flow.
