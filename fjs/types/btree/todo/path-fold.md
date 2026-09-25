## A shared `Path` fold for `set` and `remove` (investigate)

**Priority:** P3
**Status:** open

### Problem

`btree/set` and `btree/remove` both finish the same way: walk the `find` result's
`tail` (a `Path<T>`) with `fold`, rebuilding each parent branch bottom-up by
dispatching on the child-slot index `i ∈ {0, 2, 4}`, then collapse a single-child
root with `collapseRoot`.

```js
// fjs/types/btree/set/module.f.mjs — reduceOp
/** @type {<T>(i: PathItem<T>) => (a: Branch1<T> | Branch3<T>) => Branch1<T> | Branch3<T>} */
const reduceOp = ([i, x]) => a => {
    switch (i) {
        case 0: { /* rebuild left  */ }
        case 2: { /* rebuild mid   */ }
        case 4: { return b57([x[0], x[1], x[2], x[3], ...a]) }
    }
}
const reduceBranch = fold(reduceOp)
// …
return collapseRoot(reduceBranch(f())(tail))
```

```js
// fjs/types/btree/remove/module.f.mjs — reduceX
/** @type {<A, T>(ms: FixedArray<2, _Merge<A, T>>) => (item: PathItem<T>) => (a: A) => _Branch<T>} */
const reduceX = ms => ([i, n]) => a => {
    const [m0, m2] = ms
    switch (i) {
        case 0: { return f(m0) }
        case 2: { return f(m2) }
        case 4: { return [n[0], n[1], ...m2(a)([n[2], n[3], n[4]])] }
    }
}
const reduce = fold(reduceX([reduceValue0, reduceValue2]))
// …
return collapseRoot(reduce(initReduce(tf)(first))(tt))
```

Both are `fold(<rebuild parent at PathItem index i ∈ {0,2,4}>)` over `Path<T>`,
dispatching on the same `0 | 2 | 4` slot positions of a `Branch3`/`Branch5`.
`remove` already generalized the rebuild via `reduceX(ms: FixedArray<2, _Merge>)`; `set`'s
`reduceOp` is the same shape with the merge logic inlined.

### Proposed direction

Investigate a shared scaffold in `btree/types` (or `btree/find`) capturing
"fold a `Path<T>`, rebuilding the parent branch at slot `i` from a replacement
subtree", parameterized by the three slot handlers:

```ts
const foldPath = <A, T>(at0: …, at2: …, at4: …) => (seed: A) => (path: Path<T>) => …
```

`set` supplies its insert/merge handlers; `remove` supplies its `Merge`-based
ones. The single-child root collapse at the end is already shared:
`collapseRoot` in `btree/types`.

### Why this qualifies

- Separation of concerns with a weak two-consumer DRY angle: the *path-fold
  dispatch on `{0,2,4}`* is genuinely shared scaffolding, distinct from the
  per-operation merge bodies.

### Caveats — why this is "investigate", not a mechanical edit

- The accumulator types differ: `set` threads `Branch1<T> | Branch3<T>`;
  `remove` threads `_Branch<T>` and additionally splits the `Branch5` case
  (`[...ra([n0,n1,n2]), n3, n4]`, in `reduceX`'s `f`). The `case 4` handling
  also differs subtly between the two.
- A premature unification could obscure both algorithms. The right move is to
  first confirm the two handler signatures can be expressed over one
  `PathItem`-indexed interface without `as` casts, then extract.
- Lower confidence than a mechanical cleanup — file as a design
  investigation.

### Related

- i179 (retired; shipped as [`collapseRoot`](../types/module.f.mjs) in
  `btree/types`, imported by `btree/set` and `btree/remove`) — the single-child
  root collapse, the tail of both functions this issue folds together.
- [uncurry-accumulator-types](../../function/todo/uncurry-accumulator-types.md)
  (the retired `i164`, still open under a slug) — uncurrying these same `fold`
  accumulators; complementary to extracting the fold itself.
- [66F-btree-remove-mirror-merge](./66f-btree-remove-mirror-merge.md) — the
  orthogonal, *within-`remove`* left/right mirror collapse.
