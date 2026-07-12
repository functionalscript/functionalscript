## split-last-nullable-map. `splitLast` hand-rolls the null-projection its sibling routes through `nullable.map`

**Priority:** P5
**Status:** open

### Problem

The two split accessors in `fs/types/array/module.f.ts:84-99` handle absence
inconsistently:

```ts
export const splitFirst
    = <T>(a: readonly T[]): readonly [T, readonly T[]] | null => {
        const split = (first: T): readonly [T, readonly T[]] =>
            [first, uncheckTail(a)]
        return map(split)(first(a))          // routes through nullable.map
    }

export const splitLast
    = <T>(a: readonly T[]): readonly [readonly T[], T] | null => {
        const lastA = last(a)
        if (lastA === null) { return null }  // re-inlines the guard by hand
        return [uncheckHead(a), lastA]
    }
```

`splitLast` is `map(lastA => [uncheckHead(a), lastA])(last(a))` — the exact
shape `splitFirst` already uses. The `at-nullable-map` todo cites array's
safe accessors as the positive precedent for routing through `nullable.map`;
`splitLast` is the one holdout.

### Proposal

Mirror `splitFirst`:

```ts
export const splitLast
    = <T>(a: readonly T[]): readonly [readonly T[], T] | null => {
        const split = (lastA: T): readonly [readonly T[], T] =>
            [uncheckHead(a), lastA]
        return map(split)(last(a))
    }
```

### Tasks

- [ ] Rewrite `splitLast` through `nullable.map`.
- [ ] `npx tsc`, `fjs t`; array proofs pass unchanged.

### Related

- [../../ordered_map/todo/at-nullable-map.md](../../ordered_map/todo/at-nullable-map.md)
  — cites array's accessors as the precedent this holdout breaks.
