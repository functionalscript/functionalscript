## Two opposite `tailReduce`s share one name

**Priority:** P3
**Status:** open

### Problem

`module.f.mjs` binds the name `tailReduce` twice with contradictory meanings,
one shadowing the other:

```js
export const merge = cmp => {
    /** @type {TailReduce<T, null>} */
    const tailReduce = mergeTail            // :58 — keeps the remaining tail
    return genericMerge({ reduceOp: cmpReduce(cmp), tailReduce })(null)
}
const mergeTail = () => identity            // :74
const tailReduce = () => () => null         // :76 — discards the tail
export const intersect = cmp =>
    genericMerge({ reduceOp: intersectReduce(cmp), tailReduce })(null)  // :95
```

A reader at `:59` and a reader at `:95` see the same identifier meaning
opposite tail policies. The local binding exists only to carry a JSDoc
annotation; it captures nothing, so §6.3 says hoist it.

### Proposal

Rename the two to say what they do (`keepTail` / `dropTail`), annotate
`keepTail` at module scope, and delete the shadowing local. `merge` and
`intersect` then read as the same shape differing only in `reduceOp` and
tail policy.

### Tasks

- [ ] Rename `mergeTail` → `keepTail` (with the module-scope annotation) and
      the module-level `tailReduce` → `dropTail`
- [ ] Remove the shadowing local in `merge`

### Related

- [66b-sorted-list-cmp-reduce-factory](../../todo/66b-sorted-list-cmp-reduce-factory.md)
  — covers `cmpReduce` vs `intersectReduce`; this issue covers the tail
  policies
