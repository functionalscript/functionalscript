## union-is-dedup. `union` is `fjs/types/array`'s `dedup`

**Priority:** P5
**Status:** wip

### Problem

[`module.f.mjs`](../module.f.mjs)'s `union`, which `addRevisionToCache`
uses for each of its three fields, is a first-position deduplication:

```js
// union
const union = set => items =>
    items.reduce((acc, h) => acc.includes(h) ? acc : [...acc, h], set)
```

[`fjs/types/array`](../../../types/array/module.f.mjs) exports `dedup`,
which keeps each item at its first position and compares with `===`.
`set` is always one `union` built, so it holds no repeats, and
`union(set)(items)` is `dedup([...set, ...items])`.

### Proposal

Delete `union`; `addRevisionToCache` spreads and calls `dedup`.

### Tasks

- [ ] The three fields through `dedup`; `union` deleted.
- [ ] `tsc`, `fjs test`.
