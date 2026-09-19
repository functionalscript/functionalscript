## byte-list-equality. Two hand-rolled byte comparisons beside one that uses `equal`

**Priority:** P4
**Status:** open

### Problem

`fjs/types/list` exports `equal`, and `fjs/git/walk` uses it for exactly
the question git asks of two byte lists — `const same = equal(strictEqual)`,
with a doc that states the contract: byte for byte, no folding, no
normalisation. Two other git modules answer the same question by hand:

```js
// fjs/git/refstore/module.f.mjs, sameName
const sameName = (a, b) => {
    const x = toArray(a)
    const y = toArray(b)
    return x.length === y.length && x.every((v, i) => y[i] === v)
}
// fjs/git/header/module.f.mjs, keyIs
export const keyIs = ([k], key) => {
    const a = byteArray(k)
    const b = ascii(key)
    return a.length === b.length && a.every((x, j) => x === b[j])
}
```

Beyond the copy, both materialise the whole of both operands before
comparing a byte, where `equal` stops at the first difference. `sameName`
runs once per packed line per lookup, in a module whose own note at
`nameKey` worries about `packed-refs` files of twenty thousand names;
`keyIs` runs once per header for every commit and tag accessor, and
re-encodes `ascii(key)` for each header inside `valuesOf`'s `flatMap`.

### Proposal

One `sameBytes = equal(strictEqual)` in `fjs/git/refname` — the module
that owns what a name is — used by `walk`, `refstore` and `header`.
`keyIs` encodes `key` once, outside the per-header path. No behaviour
changes; the two proofs pass unchanged.

### Tasks

- [ ] `sameBytes` exported from `fjs/git/refname`; the three modules import
      it; `keyIs` hoists its `ascii(key)`.
- [ ] `tsc`, `fjs test`.

### Related

- [header-field-accessors.md](./header-field-accessors.md) — builds on
  `valueAt`, which builds on `keyIs`; the skeleton there inherits this
  comparison.
- [`../refstore/todo/packed-refs-sorted.md`](../refstore/todo/packed-refs-sorted.md) —
  bisects the scan over lines; the per-line allocation inside `sameName`
  would survive that.
