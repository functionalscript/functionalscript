# Integer object keys in lexicographic order

**Priority:** P3
**Status:** blocked

### Problem

JavaScript engines sort integer-like keys numerically before string keys, regardless of
insertion order:

```ts
const x = { 11: 11, 2: 2, a: 3, b: 5 }
// { '2': 2, '11': 11, a: 3, b: 5 }  — not lexicographic
```

FunctionalScript requires all keys to be in lexicographic order for deterministic
serialization and comparison. Integer keys violating this is a spec-level inconsistency.

### Trigger

Unblocked when ECMAScript changes the property enumeration order so integer-index keys
follow the same lexicographic ordering as string keys, or a TC39 proposal reaches Stage 4
providing opt-in deterministic ordering.
