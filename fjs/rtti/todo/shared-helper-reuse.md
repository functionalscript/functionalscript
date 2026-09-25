## shared-helper-reuse. `rtti` re-spells tiny helpers that shared modules own

**Priority:** P5
**Status:** open

### Problem

`rtti/data` and `rtti/ts` re-implement, between them, four helpers whose
canonical owners already exist under `fjs/types`:

Association-list lookup, byte-identical modulo parameter names:

```js
// fjs/rtti/data/module.f.mjs — assoc
const assoc = (list, key) => {
    for (const [k, v] of list) {
        if (k === key) { return v }
    }
    return undefined
}

// fjs/rtti/ts/module.f.mjs — idOf
const idOf = (ids, name) => {
    for (const [k, v] of ids) {
        if (k === name) { return v }
    }
    return undefined
}
```

Order-preserving dedup, byte-identical:

```js
// fjs/rtti/data/module.f.mjs — dedup
const dedup = list => list.filter((n, i) => list.indexOf(n) === i)
// fjs/rtti/ts/module.f.mjs — dedup
const dedup = list => list.filter((s, i) => list.indexOf(s) === i)
```

And uncurried re-spellings of `function/compare.cmp` and
`function/operator.strictEqual`:

```js
// fjs/rtti/data/module.f.mjs — twice in one file
const cmpString = (a, b) => a < b ? -1 : a > b ? 1 : 0
const cmpBigint = (a, b) => a < b ? -1 : a > b ? 1 : 0
// fjs/rtti/data/module.f.mjs
const strictEqual = (a, b) => a === b

// the owners:
// fjs/types/function/compare/module.f.mjs
export const cmp = a => b => a < b ? -1 : a > b ? 1 : 0
// fjs/types/function/operator/module.f.mjs
export const strictEqual = a => b => a === b
```

The only reason for the comparator copies is currying: `rtti/data` feeds
uncurried `(a, b)` comparators to `toSorted`/`cmpList`.

### Proposal

- Add `dedup` and `assoc` (linear `readonly [K, V][]` lookup by `===`) to
  `fjs/types/array/module.f.mjs` — the home of the other plain-array helpers —
  and import them from both rtti modules.
- Define the comparators through the owners:
  `const cmpString = (a, b) => cmp(a)(b)`, likewise `cmpBigint` and
  `strictEqual`. If the uncurried adaptation recurs elsewhere, add `uncurry2`
  to `fjs/types/function/module.f.mjs` instead of repeating the lambda.

### Tasks

- [ ] `fjs/types/array`: add `dedup`, `assoc` with proofs.
- [ ] `rtti/data`, `rtti/ts`: replace the four local copies with imports.
- [ ] `tsc`, `fjs t`.
