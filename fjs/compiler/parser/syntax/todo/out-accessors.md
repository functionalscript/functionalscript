## One typed `outOf(id)` for the mapping outputs

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs) reads what a mapping returned at a tree
position through `outAt(node)` and then asserts the `id`. That is written out
once per output kind, about thirty times at `ad3fb2dc` — `nodeAt`,
`parametersAt`, `itemAt`, `memberAt`, `entryAt`, `importAt`, `statementAt`,
`caseTailAt`, `moduleAt` and so on — each the same four lines:

```js
// importAt
const out = outAt(node)
assert(out.id === 'import')
return out.statement
```

`Out` in [`types.ts`](../types.ts) is already a discriminated union on `id`,
and the file already spells `Extract<Out, { readonly id: 'caseTail' }>` for
two of them.

### Proposal

One accessor, `outOf(id)(node)`, typed
`<I extends Out['id']>(id: I) => (node: _Leaf) => Extract<Out, { readonly id: I }>`,
keeping the assert and holding the one narrowing. Each reader becomes a
one-liner — `outOf('import')(node).statement` — and the readers used once
inline at their call site. The cost is a single typed narrowing inside
`outOf` where today each accessor narrows through `assert`, which
[fjs/AGENTS.md](../../../../AGENTS.md) prefers; that is the trade to weigh.

### Tasks

- [ ] Add `outOf`; rewrite the accessors over it and inline the single-use
      ones.
