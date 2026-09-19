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
    readonly scope: readonly number[]
    /** Entries written at more than one place once identity-free twins are merged — what a FunctionalScript writer hoists. */
    readonly shared: readonly number[]
    /** The source objects reached by more than one edge, operands before the nodes that use them — what a printer that binds by object identity hoists. */
    readonly identityShared: readonly ExpOp[]
}
```

**Counted in the walk, not read off the table.** The table cannot answer
this: `visited` maps a merged twin to the entry it merged into, so when two
structural-twin parents both reference one identity-minting child, the
table holds one parent and one edge to the child, while the child was
reached twice and needs a binding. Every edge into a node passes through
the walk's `node` handler exactly once — the known and the fresh case
alike — so the walk's state gains an `edges: ReadonlyMap<ExpOp, number>`
beside `visited`, and `identityShared` is its keys with a count of two or
more, in insertion order. **Insertion happens where the entry is added**,
in `fresh`, after the node's operands have been walked, and a known node
only has its count raised — so the map's order is post-order, an inner
constructor before the outer one that holds it, which is the order the
Rust emitter needs to declare a binding before the binding that uses it
and the order `visit` reports today. Recording on the way in would put
the outer first and break every nested binding. That is the count and
the order `visit` computes, taken by the traversal that already happens
instead of a second one with a `findIndex` memo. It answers in source objects rather than entry indices
because identity is the question; the entries are the merged view.

`fjs/edag/rust`'s `sharedNodesOf(root)` is then `analysis(root).identityShared`
and `visit` goes; `fsc/rust`'s `bodyLines` reads the negation check and
the binding list off one `analysis(root)`; `nanvm/rust`'s `usedShared`
filters `identityShared` by the group's reach instead of re-walking with
`reaches`. Generated Rust is unchanged, since the count is the same count.

### Tasks

- [ ] `edges` in the walk state and `identityShared` on `Analysis`, with a
      proof against the cases `fjs/edag/rust/proof.f.mjs` pins for
      `sharedNodesOf` — the nested-constructor case pins inner before
      outer — plus the twin-parents case: two structurally equal mergeable
      parents of one constructor child, the child reported shared.
- [ ] The three consumers rewritten; `npm run gen`; generated Rust
      unchanged; `tsc`, `fjs test`.

### Related

- [analysis.md](./analysis.md) — names two consumers and rules out a
  third; the Rust printers are a writer that hoists, which is the first
  kind.
- [`../rust/todo/let-bindings-owner.md`](../rust/todo/let-bindings-owner.md) —
  what the printers do with the answer.
