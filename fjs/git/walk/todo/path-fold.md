## One path fold under `walk`, with the tree reader as the hook

**Priority:** P3
**Status:** open

### Problem

`tryEntry` in [`module.f.mjs`](../module.f.mjs) folds a path over trees:
items of `{ name, last }`, a `lost` state, a `componentStep` under `foldStep`,
`mapStep(walked, s => s.found)`, descending only through `isSubtree(found)`.
At `ad3fb2dc` nothing outside this directory imports the module.

The one consumer that walks a path from a tree wrote its own: `walkTo` in
[`fjs/cas/git`](../../../cas/git/module.f.mjs) is the same fold again —
`path.map((name, i) => ({ name, last: … }))`, a `lost` of
`{ at, rel, found }`, a `component` step, `mapStep(foldStep(…), s => s.found)`
— descending through its own `isDirectory`. The differences are two hooks,
not two algorithms: how a subtree's entries are read (`walk` reads any tree;
`cas/git` reads one and refuses it for the layout, `illFormed` at the root
and `malformed(rel)` below `.cas`), and which entry descends. The layout
check itself is now spelled once, `cas/git`'s `treeRefusal(rel, es)`, which
`walkTo`'s `component`, `onlyNamed` and `listStep` each ask.

### Proposal

Generalise the private `componentStep` into an exported fold whose tree
reader is given the position:

```ts
pathFold: <O>(
    entriesAt: (id: Oid, below: readonly Bytes[]) => Effect<O, Nullable<readonly TreeEntry[]>, IoChannel>,
    descends: (e: TreeEntry) => boolean,
) => (root: readonly TreeEntry[], path: readonly Bytes[]) => Effect<O, Nullable<TreeEntry>, IoChannel>
```

`tryEntry` is `pathFold` over `readTree` and `isSubtree`, after `tryEntries`'
peel at the root. `cas/git` gains one `checkedEntries` — read, then refuse by
`treeRefusal` — and `walkTo` becomes `pathFold(checkedEntries, isDirectory)`.
The root-is-a-tree refusal in `treeOfCommit` stays where it is. Whether the `rel`-dependent
layout check fits an `(id, below)` hook cleanly is the design question.

### Tasks

- [ ] Export `pathFold`; write `tryEntry` over it.
- [x] One spelling of the layout check in `cas/git`, `treeRefusal`, asked by
      `walkTo`, `onlyNamed` and `listStep`.
- [ ] Write `checkedEntries` in `cas/git` over `treeRefusal`; replace
      `walkTo` and `lost` with `pathFold`.
