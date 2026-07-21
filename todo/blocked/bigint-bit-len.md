# `BigInt.bitLen()`

**Priority:** P3
**Status:** blocked

### Problem

There is no standard way to get the bit length of a `BigInt` without a manual loop or
`toString(2).length`, which is slow and allocates.

### Trigger

Unblocked when the ECMAScript proposal for `BigInt.bitLen()` reaches Stage 4 and ships in
Node.js LTS.

### Related

- https://github.com/nicolo-ribaudo/tc39-proposal-bigint-math
- [new-pl.md § `BigInt.bitLen`](../new-pl.md#bigintbitlen) — the new-PL section tracking this same gap.
