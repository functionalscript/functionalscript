## graph-walker. The identity-preserving "value to drawn graph" walk exists twice

**Priority:** P4
**Status:** open

### Problem

`fjs/website/demo/graph` owns the `Node`, `Edge` and `Inline` types a
drawn graph is made of, and `ranked` and `graphSvg` that lay it out —
but not the walk that produces one from a value. Two demos each write
it: `findRef`, `walk` and `_graphOf` in `fjs/media/datajs/demo.f.mjs`,
and `findRef`, `_walk` and `_graphOf` in `fjs/fsc/edag/demo.f.mjs`.
`findRef` is identical in both:

```js
const findRef = state => ref => {
    const found = state.refs.find(([r]) => is(r, ref))
    return found === undefined ? null : found[1]
}
```

and the walks share the `{ refs, nodes, edges, next }` state, the leaf
arm, the "seen before, reuse its id" branch, and the `reduce` that adds
an inline or a recursive edge per child. They differ only in how a
value's label and children are read: array and object entries in one,
the EDAG node's shape in the other.

### Proposal

The graph module exports the walk, parameterised by the one thing that
varies:

```ts
export const graphOf: <V>(shape: (v: V) => Shape<V>) => (root: V) => Graph
```

where a `Shape` is a labelled node with its children, or an inline
spelling. Each demo keeps its `shape` and drops its walk.

### Tasks

- [ ] `graphOf` with a proof that a shared child gets one node and two
      edges.
- [ ] Both demos through it; `findRef` and the two walks go.
- [ ] `tsc`, `fjs test`.

### Related

- [../graph/todo/let-in-callbacks.md](../graph/todo/let-in-callbacks.md)
  — style inside the layout; independent.
