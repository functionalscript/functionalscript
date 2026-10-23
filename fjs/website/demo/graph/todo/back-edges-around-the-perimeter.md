## Draw back edges around the perimeter

**Priority:** P3
**Status:** open

### Problem

The EDAG demo (`fjs/compiler/edag/demo.f.mjs`) cannot show recursion as an
arrow. Recursion lowers to `['()', ['self'], args]`, and `['self']` is the
innermost function whose body holds it
([`fjs/edag/README.md`](../../../../edag/README.md)). The demo draws it as a
terminal cell, `self`, in the call's `callee` row, so a reader of

```js
const f = n => n === 0 ? 1 : n * f(n - 1); export default f;
```

sees a `()` node whose callee is a word rather than a link to the `=>` node it
calls.

The graph module cannot draw that link either. Its layout is layered and runs
left to right: [`ranked`](../module.f.mjs) places every node at its longest
path from the root, so every edge points right. `graphOf` refuses any value
that reaches itself, because an edge back to a node it is still inside would
point left, and `ranked` cannot place one. That refusal is correct for the
layout as it stands, and it is the reason the demo uses a terminal cell.

### Proposal

Let a graph carry **back edges** as a separate list, and keep them out of
ranking. The forward edges still make a DAG, so `ranked`, the columns and the
lanes do not change. Back edges are routed afterwards, **around the outer
perimeter of the drawing**, not through it. A back edge then cannot cross a
box, and it crosses forward edges only in the gaps beside its two ends.

Route of a back edge from a port in rank `r` to a node in rank `t ≤ r`:

1. right from the port's right end into the gap after rank `r`, as a forward
   edge leaves;
2. down that gap to below the lowest node or lane of the whole drawing;
3. left along the bottom to the gap before rank `t` (the left margin when
   `t = 0`);
4. up that gap to the middle of the target's left side, ending in the
   arrowhead every edge has there.

Every vertical segment is in a gap between columns, where no box is, and the
horizontal run is below everything. This is the same guarantee the module
gives forward edges: no edge crosses a box.

**Several back edges get a lane each.** The `k`-th back edge runs its bottom
segment `k` lane widths below the drawing, and its two verticals `k` lane
widths further out from their columns. Lanes are assigned so that spans nest:
the back edge with the widest rank span takes the outermost lane. Nested
spans then never cross each other, and only overlapping spans that are not
nested do. The drawing's height grows by one lane per back edge. Its width
grows only where a back edge enters the left margin.

**The edge is drawn as a back edge.** It is a class or `kind` on the path,
not a new shape, so the site's stylesheet can tell it apart, for example in a
muted colour, as `lazy` edges are drawn broken.

### What the EDAG demo does

Its walk knows the innermost `=>` it is inside, so it can resolve each
`['self']` to that node's id and emit a back edge from the `callee` row in
place of the terminal cell. A nested function's captured parent `self` is a
slot holding `['self']` in the parent's scope, so it resolves to the parent,
which is what it means. `Shape` is read one value at a time with no
context, so the owner either travels in the walk's frame or `Shape` gains a
way to say "an edge to my enclosing node of kind X". Which of the two gives
the simpler API is the first question for an implementation.

### Open questions

- **A self-loop**, where `t = r` and the target is the source's own node,
  such as a `=>` whose body is a direct `self` read: the same route works,
  out of the right side and back into the left. A short loop beside the node
  would read better, but it is a special case and should wait until an
  example asks for it.
- **Keyed drawings.** A keyed route must keep a fixed number of points so
  that its `d` can slide. A back edge has a fixed shape (six points), so it
  can be keyed by its ends like any other edge.
- **Generality.** Only the EDAG demo needs this now. A DataJS value cannot
  reach itself, so the refusal in `graphOf` stays for values a demo does not
  declare as back edges.
