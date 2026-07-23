# Integer object keys in lexicographic order

**Priority:** P3
**Status:** blocked

### Problem

JavaScript engines sort integer-like keys numerically before string keys, regardless of insertion order:

```ts
const x = { 11: 11, 2: 2, a: 3, b: 5 }
// { '2': 2, '11': 11, a: 3, b: 5 }  — not lexicographic
```

FunctionalScript requires all keys to be in lexicographic order for deterministic
serialization and comparison. Integer keys violating this is a spec-level inconsistency.

### Trigger

Most likely, ECMAScript would never fix it because of compatibility reasons.

### Related

- [new-pl.md § Always Lexicographical Order](../new-pl.md#always-lexicographical-order) — a from-scratch PL isn't bound by ECMAScript's compatibility constraint and adopts pure lexicographic key order directly.
