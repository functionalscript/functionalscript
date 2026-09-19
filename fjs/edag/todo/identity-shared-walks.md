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

An identity-only answer exported from `fjs/edag/analysis`, built from the
`walk`/`visited` map the table already constructs:

```ts
/** The nodes reached by more than one edge, by identity, in walk order. */
export const identityShared: (e: Exp) => readonly Exp[]
```

`fjs/edag/rust` imports it and drops `visit`; `fsc/rust`'s `bodyLines` makes
one `analysis` call and reads both answers off it; `nanvm/rust`'s
`usedShared` filters against the analysis rather than re-walking with
`reaches`.

### Tasks

- [ ] `identityShared` in `fjs/edag/analysis` with a proof against the
      cases `fjs/edag/rust/proof.f.mjs` pins for `sharedNodesOf`.
- [ ] The three consumers rewritten; `npm run gen`; generated Rust
      unchanged; `tsc`, `fjs test`.

### Related

- [analysis.md](./analysis.md) — names two consumers and rules out a
  third; the Rust printers are a writer that hoists, which is the first
  kind.
- [`../rust/todo/let-bindings-owner.md`](../rust/todo/let-bindings-owner.md) —
  what the printers do with the answer.
