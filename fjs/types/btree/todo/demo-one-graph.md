## Draw the demo's two versions as one graph

**Priority:** P3
**Status:** open

### Problem

The B-tree demo (`fjs/types/btree/demo.f.mjs`) draws the tree before and
after a step as two separate graphs, and shows which nodes the versions share
only by colour. Asked in
[#2458](https://github.com/functionalscript/functionalscript/pull/2458):
draw both trees on one graph instead, so a shared subtree is one node reached
from both roots, and the sharing is the drawing itself rather than a colour
the reader has to match across two pictures.

### Notes

- The shared `graph` module already draws one node per distinct reference,
  so a root holding both versions draws shared subtrees once.
- The two roots may then sit on different ranks — after a removal that
  shrinks the tree, or an insert that grows it — and that is acceptable.
- Two drawings were chosen first because each tree's shape stays readable;
  whether one graph reads better is what this task is to find out, by trying
  it.
