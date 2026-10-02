## Align parents with their children

**Priority:** P3
**Status:** open

### Problem

`layout` packs every column from the top: a column's slots are stacked one
under another from `margin`, in key order, whatever their parents and
children are doing. A node's height is what keeps it next to its children.

A node with one labelled row per child — a B-tree branch with `Left`,
`Middle`, `Right` — is about as tall as its children's column span, so it
roughly lines up with them, and its arrows are short. A node whose children
leave from corners (`Edge.corner`) is only its values tall: the parents pack
into the top of their column while their children run much further down the
next one. Every arrow leaves from one of a few points on a parent's right
side, so a big tree draws a fan of long diagonal arrows that converge and
cross, and a reader cannot tell which child belongs to which parent.

That is why the B-tree demo (`fjs/types/btree/demo.f.mjs`) still draws its
children from labelled rows, while the Patricia trie demo, whose trees are
smaller, draws them from corners.

### Proposal

Place a node beside its children instead of at the top of its column: at
the middle, or the top, of the span its children cover in the next column,
the way a classic tree layout does. Columns would be placed right to left,
leaves first, and a node pushed down only where it would overlap the one
above it. An edge's lanes in the ranks it skips follow the same rule.

A node a step left behind and the node that replaced it both have children;
which span such a node follows, and what a node with two parents (shared by
both versions) does to its parents' spans, are part of the design.

### Tasks

- [ ] Place each node beside the span of its children in `layout`.
- [ ] Draw the B-tree demo's children from corners, as the trie's are, and
      drop its `Left` / `Middle` / `Right` rows.

### Related

- [Discussion](https://github.com/functionalscript/functionalscript/pull/2513#issuecomment-5959123065)
  — the B-tree's **Big tree** preset drawn from corners, and why it is hard
  to read.
- [`versions`](../../versions/module.f.mjs) — the demo module both drawings
  come from.
