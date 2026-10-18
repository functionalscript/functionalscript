## A B-tree compaction game

**Priority:** P3
**Status:** open

### Idea

A puzzle on the [btree demo](../demo.f.mjs)'s drawing: the player gets a tree
and makes it a **perfect tree** — every node full, two keys, and every branch
three children — with one move only: click a key, and it is removed and
inserted again. The keys never change, only the shape does. Fewer moves is a
better score, and each level has a par: the fewest moves that reach the goal.

The move is the demo's own click (remove, then insert the same key), so the
game needs no new operation on the tree: it is a goal, a move counter and a
par around `set` and `remove`.

### Levels

A perfect tree of depth `d` has `3^(k-1)` nodes on level `k`,
`(3^d - 1) / 2` nodes in all, and `3^d - 1` keys, so each level's key count is
fixed:

| Depth | Nodes per level | Nodes | Keys |
| ----- | --------------- | ----- | ---- |
| 2     | 1, 3            | 4     | 8    |
| 3     | 1, 3, 9         | 13    | 26   |
| 4     | 1, 3, 9, 27     | 40    | 80   |

A level's starting tree is built by inserting its keys in random order.

### What an exploration found

A search over the move, from one start per depth:

- **The game is possible.** The move really changes the shape, and at
  depths 2 and 3 it reaches the perfect tree.
- **Par can be computed at depth 3.** Every shape reachable from a start can
  be listed in a short search, so the par is exact. At depth 4 the shapes
  are too many to list, and a random search did not reach the perfect tree:
  its par needs another method, or stays unknown.
- **Many moves change nothing.** A key in a leaf with room goes back where
  it was. Such a move should say so, as the demo's remove of a missing key
  does, rather than look like a move that failed.

### Open questions

- **Progress between goals.** Depth alone barely moves — most moves leave it
  as it was — so the board should also show the node count: fewer nodes
  means fuller nodes, which is how the depth drops.
- **Where it lives.** The goal, the move count and the par are game state,
  not the versions demo's: a module of its own, with proofs that each
  level's goal is reachable and its par is what the level says.
