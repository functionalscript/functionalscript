# 179. `btree`: name the "collapse single-child root" step

`fs/types/btree/set/module.f.ts` and `fs/types/btree/remove/module.f.ts` both
end by demoting an over-tall root — a `Branch` holding a single child — to that
child. The step is written as the same bare ternary reaching into tuple
internals in both modules.

```ts
// fs/types/btree/set/module.f.ts:107
const r = reduceBranch(f())(tail)
return r.length === 1 ? r[0] : r

// fs/types/btree/remove/module.f.ts:137
const result = reduce(initReduce(tf)(first))(tt)
return result.length === 1 ? result[0] : result
```

`length === 1 ? x[0] : x` is the canonical "the root grew/shrank a level, so a
single-child branch becomes its child" invariant of a 2-3-4 tree. It is the same
operation in both the insert and the remove paths.

## Proposed abstraction

A named helper in `fs/types/btree/types/module.f.ts` (or `btree/module.f.ts`):

```ts
// a one-child branch root collapses to its single child
export const collapseRoot = <T>(b: Branch<T>): TNode<T> =>
    b.length === 1 ? b[0] : b
```

Both call sites become `return collapseRoot(r)` / `return collapseRoot(result)`.

## Why this qualifies

- Two real consumers (`set`, `remove`) — meets the second-consumer bar.
- It names a real B-tree invariant and stops two modules from independently
  indexing `[0]` into branch tuples, which is exactly the kind of structural
  detail that should live with the node types.

## Caveats

- Small mechanical win; the value is the shared vocabulary and keeping
  tuple-shape knowledge in one place. Confirm the exact branch type
  (`Branch1To3`/`Branch` union) so the signature matches both call sites without
  an `as` cast.
- Verify both sites genuinely produce a branch whose length-1 case is a
  well-formed single child (they do today via `reduceBranch`/`reduce`); the
  helper must not paper over an unexpected empty branch.

## Related

- [i161](./README.md) — `string_set`/`ordered_map` keyed-collection core over
  the same B-tree primitives.
