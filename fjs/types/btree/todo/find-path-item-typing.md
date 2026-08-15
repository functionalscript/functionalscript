# `btree/find` casts every tuple it builds or indexes

**Priority:** P3
**Status:** open

### Problem

Three casts in `fjs/types/btree/find/module.f.mjs`, all the same shape — a
tuple the compiler will not build or read at the width the code knows it has:

| Line | Cast | |
| --- | --- | --- |
| 17 | `TNode<T>` | `item[1][item[0]]` — indexing a node by a variable index yields the union of its element types, not the element at that index |
| 29 | `PathItem<T>` | `[index, node]` — the pair widens instead of staying a tuple |
| 33 | `First<T>` | `[index, node]` — likewise |

The two constructions are the more tractable half: a tuple literal in an
argument or property position widens unless something pins it, and the repo
already has that problem solved elsewhere with an annotated `const` or
`@type {const}`. The indexed read is harder, and is the same limitation
`Index<3>`/`Index<5>` ran into in `types/function/compare` — TypeScript cannot
correlate a variable index with the element it selects.

### Proposal

Try the annotated-declaration form for lines 29 and 33 first; if the tuple stays
pinned, those two are cast-free with no type changes. For line 17, work out
whether `PathItem<T>` can carry the index as a literal type so `item[1][item[0]]`
resolves, or record that it cannot.

### Related

- [`todo/inline-type-casts.md`](../../../../todo/inline-type-casts.md) — where
  these three were measured; the `compare` sites in the same audit became
  `assert`s over the literal range, which is the fallback if the types cannot
  express it.
