# 180. `sorted_set`/`sorted_list`: move `intersect` engine to `sorted_list`

`fs/types/sorted_set/module.f.ts` keeps `sorted_set` a thin array wrapper for
*union* — `union` just calls `toArray` over `sorted_list.merge` — but for
*intersection* it defines the list-level engine itself. The two set operations
therefore live in different modules, breaking an otherwise clean symmetry.

```ts
// fs/types/sorted_set/module.f.ts:37  — union delegates to sorted_list.merge
export const union = cmp => a => b => toArray(merge(cmp)(a)(b))

// fs/types/sorted_set/module.f.ts:40  — intersect's engine is defined HERE
export const intersect = cmp => a => b => toArray(intersectMerge(cmp)(a)(b))
const tailReduce = () => () => null
const intersectMerge = cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce })(null)
const intersectReduce = cmp => state => a => b => {
    const sign = cmp(a)(b)
    return [sign === 0 ? a : null, sign, state]
}
```

`merge` (union at the list level) is an exported `sorted_list` operation;
`intersectMerge` (intersection at the list level) is a private `sorted_set` one.
Both are `SortedList → SortedList → SortedList` built on `sorted_list`'s
`genericMerge`. The asymmetry means a future ordered collection that wants
list-level intersection can't reuse it.

## Proposed abstraction

Move `intersectReduce`/`intersectMerge` into `fs/types/sorted_list/module.f.ts`
as an exported `intersect`, mirroring the existing `merge`:

```ts
// sorted_list
export const intersect: <T>(cmp: Cmp<T>) => (a: SortedList<T>) => (b: SortedList<T>) => SortedList<T>
    = cmp => genericMerge({ reduceOp: intersectReduce(cmp), tailReduce: dropTail })(null)
```

Then `sorted_set.intersect = cmp => a => b => toArray(sortedList.intersect(cmp)(a)(b))`,
exactly paralleling how `sorted_set.union` consumes `sorted_list.merge`.

While moving it, the two trivial `TailReduce` values that `genericMerge` takes
could become named `sorted_list` exports, replacing the anonymous
`() => () => null` (drop the leftover tail, used by intersect) and the
plain-merge "keep the tail" reducer:

```ts
// sorted_list
export const dropTail: TailReduce<unknown, unknown> = () => () => null
```

so "what happens to the leftover tail" reads as named vocabulary of the merge
framework rather than an inline lambda the reader must decode.

## Why this qualifies

- Separation of concerns: the list-level set algebra (`merge` = union,
  `intersect`) belongs together in `sorted_list`; `sorted_set` stays a uniform
  `toArray`-wrapping layer for *both* operations.
- This is a single-consumer move justified by clarity/symmetry rather than a
  2-consumer DRY extraction — it restores parity with the already-shared
  `merge` and removes the only place `sorted_set` reaches past the array
  abstraction.

## Caveats

- Pure relocation: no behavior change, no new public algorithm. Confirm
  `intersectReduce`'s `ReduceOp<T, S>`/`TailReduce` types line up with
  `sorted_list`'s existing exports so nothing needs an `as` cast.
- The named-`TailReduce` part (`dropTail`/`keepTail`) is optional polish; the
  core change is the relocation. `range_map.get` also uses `genericMerge` with a
  genuinely non-trivial tail reducer, so don't try to collapse all callers onto
  the two trivial ones.

## Related

- [i161](./README.md) — "a set is a map whose key is its value"; this issue is
  the analogous "a sorted set is a sorted list" framing for the set algebra.
- [i164](./README.md) — uncurrying `sorted_list`'s `ReduceOp`/`TailReduce`
  accumulators; touches the same `genericMerge` callbacks.
