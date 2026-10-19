## Name edge targets in the demo's rows

**Priority:** P3
**Status:** blocked — on the chain and key drawing of
[pull request 3021](https://github.com/functionalscript/functionalscript/pull/3021)

### Problem

In [`../demo.f.mjs`](../demo.f.mjs), a node whose operands are some
constants and some nodes draws them unlike each other. A constant's port is
its key beside its value, the keys in one column; an edge's port is its key
alone, centred across the whole row. An `[]` node's indexes and a binary
operator's `left` and `right` do not line up, and the row an edge leaves
from looks like a value missing.

Pull request 3021 makes it more common: a property read's key and a
function's length become values beside the edges of the same node.

### Proposal

`fjs/website/demo/graph` draws such rows uniformly when a `Graph` asks for
`targets`: an edge's key in the key column, and the label of the node it
leads to in the value's place, marked `data-graph-value-ref` and drawn as
part of the edge. The rtti demo already asks for it. Here it is one line,
in `_graphOf`:

```js
ok({ ...graphOf(_shapeOf)(drawn(unresolved(ast).edag)), targets: true })
```

### What changes besides

The demo's lesson is that one node reached by many edges is shared: the
Overview draws `a` as one `+` node reached by six. With `targets`, the rows
of the edges into it that sit beside a value also say `+`, muted and
italic, while the node's own label is still drawn once. Whether the rows
blur that lesson is the decision this issue asks for; drawn, they read as
references to the one box, which the arrows confirm.

The proofs that count drawn text change with it:

- `sharing` counts `>+<`, which the rows now carry too; it would count the
  node's label, `data-graph-label="">+<`, and the rows apart.
- `kinds` counts every `data-graph-value=""` cell; the cells naming a target
  carry that attribute too, beside `data-graph-value-ref`, and would be
  counted apart.

Do it after 3021 lands, so the counts are taken from the drawing it leaves.
