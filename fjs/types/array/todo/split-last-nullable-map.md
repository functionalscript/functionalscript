## split-last-nullable-map. `splitLast` hand-rolls the null-projection its sibling routes through `nullable.map`

**Priority:** P5
**Status:** open

### Problem

The two split accessors in `fjs/types/array/module.f.mjs:105-119` handle
absence inconsistently:

```js
export const splitFirst = a => {
    /** @typedef {(typeof a)[0]} T */
    const split = (/** @type {T} */first) =>
        /** @type {const} */([first, uncheckTail(a)])
    return map(split)(first(a))          // routes through nullable.map
}

export const splitLast = a => {
    const lastA = last(a)
    return lastA === null ? null : [uncheckHead(a), lastA]  // re-inlines the guard by hand
}
```

`splitLast` is `map(lastA => [uncheckHead(a), lastA])(last(a))` — the exact
shape `splitFirst` already uses. The `at-nullable-map` todo cites array's
safe accessors as the positive precedent for routing through `nullable.map`;
`splitLast` is the one holdout.

### Proposal

Mirror `splitFirst`:

```js
export const splitLast = a => {
    /** @typedef {(typeof a)[0]} T */
    const split = (/** @type {T} */lastA) =>
        /** @type {const} */([uncheckHead(a), lastA])
    return map(split)(last(a))
}
```

### Tasks

- [ ] Rewrite `splitLast` through `nullable.map`.
- [ ] `npx tsc`, `fjs t`; array proofs pass unchanged.

### Related

- [../../ordered_map/todo/at-nullable-map.md](../../ordered_map/todo/at-nullable-map.md)
  — cites array's accessors as the precedent this holdout breaks.
