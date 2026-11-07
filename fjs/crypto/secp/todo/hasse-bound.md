## The Hasse-bound test, derived twice

**Priority:** P4
**Status:** open

### Problem

Whether a count of points exceeds `p + 1 + 2√p` is answered in integers
by the same derivation in two modules, with the same comment and the
inequalities in opposite orders:

```js
// secp: isPublicKey
// `n² > p + 1 + 2√p`, in integers: `d = n² - p - 1 > 0` and `d² > 4p`.
const d = n * n - p - 1n
const nTorsionIsSubgroup = d > 0n && d * d > 4n * p
// mental_poker: mentalPoker
// `2n > p + 1 + 2√p`, in integers: `d = 2n - p - 1 > 0` and `d² > 4p`.
const d = 2n * n - p - 1n
assert(0n < d && 4n * p < d * d, ['curve points outside the group of order n', p, n])
```

in [`module.f.js`](../module.f.js) and
[`fjs/crypto/mental_poker`](../../mental_poker/module.f.js). The reasoning
that makes the squaring sound, the sign guard, lives in two places and is
proved twice.

### Proposal

`exceedsHasseBound = p => count => { const d = count - p - 1n; return d >
0n && d * d > 4n * p }` exported from `secp`, which owns the curve
arithmetic, with the one comment; `isPublicKey` asks it of `n * n` and
`mentalPoker` of `2n * n`. One proof entry pins the boundary: the count
`p + 1 + 2√p` for a square `p` is refused, one more is admitted.

### Tasks

- [ ] `exceedsHasseBound` with its boundary proof.
- [ ] Both callers over it.
- [ ] `tsc` and the suites under `fjs/crypto`.

### Related

- [`mental_poker/todo/composite-order`](../../mental_poker/todo/composite-order.md)
  — the other number-theoretic guard in that module.
