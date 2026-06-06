# 185. `byte_set`: build `range`/`one` from `bigint.mask`

**Priority:** P3
**Status:** open

`byte_set` hand-rolls contiguous bit masks that already exist as `bigint.mask`.

```ts
// fs/types/byte_set/module.f.ts:24
export const one: (n: Byte) => ByteSet
    = n => 1n << BigInt(n)

// fs/types/byte_set/module.f.ts:27
export const range: (r: readonly[Byte, Byte]) => ByteSet
    = ([b, e]) => one(e - b + 1) - 1n << BigInt(b)
```

```ts
// fs/types/bigint/module.f.ts:206
export const mask = (len: bigint): bigint =>
    (1n << len) - 1n
```

`range`'s `one(k) - 1n` is exactly `(1n << BigInt(k)) - 1n = mask(BigInt(k))`, so
the whole expression is a shifted `mask`:

```ts
one(e - b + 1) - 1n << BigInt(b)
// === (because subtraction binds tighter than `<<`)
(mask(BigInt(e - b + 1))) << BigInt(b)
```

`byte_set` is re-deriving `mask`'s `(1n << len) - 1n` via `one(k) - 1n` instead of
importing it.

## Proposed abstraction

Import `mask` from `bigint` and rewrite:

```ts
// fs/types/byte_set
import { mask } from '../bigint/module.f.ts'

export const range: (r: readonly[Byte, Byte]) => ByteSet
    = ([b, e]) => mask(BigInt(e - b + 1)) << BigInt(b)
```

`one` may stay as a single-bit shift (it reads clearly), or also be expressed as
the degenerate mask — but the clear win is `range`.

## Why this qualifies

- DRY: `bigint.mask` gains a genuine second consumer (it is currently used inside
  `bigint` and `bit_vec`); the bit-mask *arithmetic* belongs in `bigint`, not
  inlined in a byte-set codec.
- Separation of concerns in the spirit of [i178](./README.md) (move bit
  arithmetic to its natural home) — but a distinct pair (`byte_set` → `bigint`
  rather than `cbase32` → `bit_vec`).

## Caveats

- The operator-precedence reading matters: `one(e - b + 1) - 1n << BigInt(b)`
  parses as `(one(e-b+1) - 1n) << BigInt(b)`, which is exactly
  `mask(...) << BigInt(b)`, so the rewrite is behavior-preserving. The existing
  `byte_set` tests should confirm this.
- `has` (`byte_set/module.f.ts:15`, `((s >> BigInt(n)) & 1n) === 1n`) has no
  existing `bigint` equivalent; leave it as is — this issue is only about the
  `mask` duplication.
- Unrelated to the dead `nibble_set` of [i160](./README.md).

## Related

- [i178](./README.md) — same "bit arithmetic belongs in its numeric/bit module"
  theme.
- [i167](./README.md) — `bit_vec` re-binding flagged similarly.
