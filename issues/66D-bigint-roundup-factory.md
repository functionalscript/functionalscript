# 66D-bigint-roundup-factory. `bigint`: share the divide-then-scale-up skeleton of `roundUp`

**Priority:** P5
**Status:** open

## Problem

`fs/types/bigint/module.f.ts` defines two `roundUp` variants that have the same
shape — build the matching `divUp`, then scale the quotient back up by the same
amount:

```ts
// :258-261
export const roundUp = (b: bigint): Unary => {
    const d = divUp(b)
    return v => d(v) * b
}

// :280-283
export const roundUpE2 = (e: bigint): Unary => {
    const d = divUpE2(e)
    return v => d(v) << e
}
```

Both are `arg => { const d = divUp(arg); return v => scaleUp(d(v), arg) }`. They
differ only in which `divUp` they pair with (`divUp` vs `divUpE2`) and the
"scale back up" operator (`* b` vs `<< e`) — and those two choices are not
independent: integer division pairs with multiply, power-of-two shift-down pairs
with shift-up. The compose-and-scale skeleton is written twice.

(The `divUp` / `divUpE2` pair itself is *not* a shared skeleton — they compute
their adjustment differently, `b - 1n` vs `mask(e)`, and use different operators,
so only the `roundUp` layer is duplicated.)

## Proposal

Factor the shared "divide then scale up" wiring into one private factory
parameterized by the `divUp` it composes and the scale-up operator, then derive
both:

```ts
const roundUpVia = (divUp: (n: bigint) => Unary, scaleUp: (q: bigint, n: bigint) => bigint) =>
    (n: bigint): Unary => {
        const d = divUp(n)
        return v => scaleUp(d(v), n)
    }

export const roundUp = roundUpVia(divUp, (q, b) => q * b)
export const roundUpE2 = roundUpVia(divUpE2, (q, e) => q << e)
```

The mechanics (build the divider once, apply, scale) live in one place; only the
genuine per-variant pair — its divider and its inverse operator — remains at each
derivation.

## Why this is filed at P5

The originals are three lines each and already readable; the factory adds an
indirection a reader must follow. This is the same caliber as
[i66B-sorted-list-cmp-reduce-factory](./66B-sorted-list-cmp-reduce-factory.md) —
worth doing if the file is touched anyway, or as a prerequisite when a third
divide-then-scale variant is added, but not on its own.

## Tasks

- [ ] Add `roundUpVia` and derive `roundUp` / `roundUpE2` from it.
- [ ] Confirm `fs/types/bigint/proof.f.ts` still passes (`fjs t`) with full branch
      coverage and `npx tsc` is clean.

## Related

- [i66A-divup8-bits-to-bytes](./66A-divup8-bits-to-bytes.md) — adjacent
  `bigint` divide-up cleanup (`divUp8 = divUpE2(3n)`).
- [i66B-sorted-list-cmp-reduce-factory](./66B-sorted-list-cmp-reduce-factory.md) —
  the same "share a skeleton, keep only the per-variant difference" pattern at the
  same priority.
