# 66D-operator-concat-from-join. `function/operator`: derive `concat` from `join('')`

**Priority:** P5
**Status:** open

## Problem

`fs/types/function/operator/module.f.ts` defines two string reducers that are
the same fold modulo a separator:

```ts
// :10-11
export const join = (separator: string): Reduce<string> => value => prior =>
    `${prior}${separator}${value}`

// :13-14
export const concat: Reduce<string> = i => acc =>
    `${acc}${i}`
```

`concat` is exactly `join` with an empty separator: rename `i`/`acc` to
`value`/`prior` and `join('')` produces `` `${prior}${value}` ``, byte-for-byte
`concat`'s body. The two implementations of "append to an accumulator string"
sit two lines apart, and a reader has to evaluate both templates to notice they
coincide.

## Proposal

Derive `concat` from `join`, making the relationship explicit and removing the
second hand-written template:

```ts
export const concat: Reduce<string> = join('')
```

The annotation stays (per the "annotate exported declarations" guidance) and the
public contract is unchanged. Both `concat` and `join` have external consumers
(`fs/types/string`, `fs/text/utf16`) and are exercised in
`fs/types/function/operator/proof.f.ts`, so this is a pure internal
simplification.

## Why this is filed at P5

The originals are two lines each and already readable; this is the same caliber
as [i66B-sorted-list-cmp-reduce-factory](./66B-sorted-list-cmp-reduce-factory.md)
— worth doing if the file is touched anyway, not on its own.

## Tasks

- [ ] Replace `concat`'s body with `join('')`.
- [ ] Confirm `fs/types/function/operator/proof.f.ts` still passes (`fjs t`) and
      `npx tsc` is clean.

## Related

- [i66B-sorted-list-cmp-reduce-factory](./66B-sorted-list-cmp-reduce-factory.md) —
  another low-priority "derive one operator from a more general one" cleanup.
