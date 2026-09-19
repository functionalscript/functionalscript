## identity-shared-walks. Three walks decide which EDAG nodes are shared

**Priority:** P4
**Status:** open

### Problem

`fjs/edag/analysis` exists to answer "which nodes are shared" once, for a
writer and a VM — its doc says so. Two Rust printers answer it themselves:

```js
// fjs/edag/rust/module.f.mjs, visit — an identity-keyed count with a findIndex memo
const visit = visited => root => {
    if (!(root instanceof Array)) { return visited }
    const i = visited.findIndex(([n]) => n === root)
    if (i !== -1) { return visited.map((v, j) => j === i ? [v[0], v[1] + 1] : v) }
    const withChildren = root.reduce((v, child) => visit(v)(child), visited)
    return [...withChildren, [root, 1]]
}
export const sharedNodesOf = root => visit([])(root).filter(([, count]) => count >= 2).map(([node]) => node)
// fjs/nanvm/rust/module.f.mjs, reaches — a third reachability walk
const reaches = (e, n) => e === n || (e instanceof Array && e.some(x => reaches(x, n)))
```

and `fjs/fsc/rust`'s `bodyLines` runs two of them over the same root:
`analysis(root)` for the negation check, then `sharedNodesOf(root)` for the
bindings. The two notions do differ — `analysis` merges structurally equal
identity-free nodes within a scope, `sharedNodesOf` counts object identity
— which is a reason to name the second where the first lives, not to keep
it in a printer with a quadratic memo.

### Proposal

The identity answer becomes part of the one table `analysis` already
returns, so a consumer that needs both makes one call:

```ts
export type Analysis = {
    readonly root: Operand
    readonly nodes: readonly Node[]
    /** One source expression per entry, in walk order: the object `nodes[i]` was built from. */
    readonly exps: readonly ExpOp[]
    readonly scope: readonly number[]
    /** Entries written at more than one place once identity-free twins are merged — what a FunctionalScript writer hoists. */
    readonly shared: readonly number[]
    /** Entries reached by more than one edge, every edge counted once — what a printer that binds by object identity hoists. */
    readonly identityShared: readonly number[]
}
```

No second traversal: `identityShared` is the same `places` fold as `shared`
with every edge weighted `1` instead of `mergeable`-weighted, and `exps` is
the walk's `visited` map read back in entry order, which the walk already
keeps as its one identity-keyed structure. `fjs/edag/rust`'s
`sharedNodesOf(root)` is then `identityShared.map(i => exps[i])` and `visit`
goes; `fsc/rust`'s `bodyLines` reads the negation check and the binding
list off one `analysis(root)`; `nanvm/rust`'s `usedShared` filters
`identityShared` by the group's reach instead of re-walking with `reaches`.

One difference to pin in the proof rather than paper over: `visited` maps
a merged node to the entry it merged into, so two structurally equal
identity-free objects are one entry and get one `let`, where `visit`
counted them apart. That is a correct binding — the two objects denote one
value — and it changes generated Rust only for a program that writes such
twins; the task below says which fixtures, if any, move.

### Tasks

- [ ] `exps` and `identityShared` on `Analysis`, with a proof against the
      cases `fjs/edag/rust/proof.f.mjs` pins for `sharedNodesOf`, the
      merged-twins case pinned separately.
- [ ] The three consumers rewritten; `npm run gen`; any change in generated
      Rust is a merged-twins case and is named in the PR; `tsc`, `fjs test`.

### Related

- [analysis.md](./analysis.md) — names two consumers and rules out a
  third; the Rust printers are a writer that hoists, which is the first
  kind.
- [`../rust/todo/let-bindings-owner.md`](../rust/todo/let-bindings-owner.md) —
  what the printers do with the answer.
