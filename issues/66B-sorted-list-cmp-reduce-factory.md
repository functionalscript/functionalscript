# 66B-sorted-list-cmp-reduce-factory. `sorted_list`: share the compare-and-select reduce shape

**Priority:** P5
**Status:** open

## Problem

`fs/types/sorted_list/module.f.ts` defines two `ReduceOp<T, null>` constructors
for `genericMerge` that are identical except for the value they place in the
first tuple slot:

```ts
// :48-51
const cmpReduce = <T>(cmp: Cmp<T>): CmpReduceOp<T> => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 1 ? b : a, sign, null]
}

// :57-60
const intersectReduce = <T>(cmp: Cmp<T>): ReduceOp<T, null> => () => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : null, sign, null]
}
```

Both share the entire skeleton — the `() => a => b =>` shape, the
`const sign = cmp(a)(b)` comparison, and the `[…, sign, null]` return envelope.
They differ only in how the first element is selected from `sign`/`a`/`b`:
`merge` keeps the larger (`sign === 1 ? b : a`), `intersect` keeps the equal one
or drops it (`sign === 0 ? a : null`).

## Proposal

Factor the shared skeleton into one factory parameterized by the selector,
deriving both reducers point-free:

```ts
const cmpReduceBy = <T>(select: (sign: Sign, a: T, b: T) => Nullable<T>) =>
    (cmp: Cmp<T>): ReduceOp<T, null> => () => a => b => {
        const sign = cmp(a)(b)
        return [select(sign, a, b), sign, null]
    }

const cmpReduce = cmpReduceBy<unknown>((sign, a, b) => sign === 1 ? b : a)
const intersectReduce = cmpReduceBy<unknown>((sign, a, b) => sign === 0 ? a : null)
```

The compare-and-thread-`sign` mechanics live once; only the per-operation
selection rule remains at each derivation, which is the genuine difference
between "merge" and "intersect".

## Why this is filed at P5

This is borderline against the `AGENTS.md` "readability over DRY for short, clear
functions" guidance — the originals are three lines each and already readable,
and the `select` callback adds an indirection a reader must follow. It is the
same caliber as [i66A-emergent-add-result](./66A-emergent-add-result.md) (two
near-identical updaters differing in one slot), filed at the same low priority:
worth doing if the file is being touched anyway, or as a prerequisite if a third
sign-driven merge reducer is added (e.g. set difference), but not on its own.

## Tasks

- [ ] Add `cmpReduceBy` and derive `cmpReduce` / `intersectReduce` from it.
- [ ] Confirm `fs/types/sorted_list/proof.f.ts` still passes (`fjs t`) with full
      branch coverage and `npx tsc` is clean.

## Related

- [i180-sorted-set-intersect-symmetry](./180-sorted-set-intersect-symmetry.md) —
  adjacent sorted-collection merge/intersect cleanup.
- [i66A-emergent-add-result](./66A-emergent-add-result.md) — the same
  "two updaters differing in one slot" pattern, filed at the same priority.
