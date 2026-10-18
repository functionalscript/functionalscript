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

### What an exploration found

Starting from the keys 10, 20, … inserted in order, and following every move
from every shape reached (breadth-first, with a shape compared by its keys):

- **Depth 2, 8 keys.** The start is depth 3 with 7 nodes; 5 shapes are
  reachable, the perfect one among them. A tutorial level.
- **Depth 3, 26 keys.** The start is depth 4 with 23 nodes; 12,909 shapes are
  reachable, the perfect one (13 nodes) among them. A real puzzle, small
  enough for its par to be computed exhaustively.
- **Depth 4, 80 keys.** The start is depth 6 with 78 nodes. The shapes are
  too many to enumerate, and two million random moves that kept any move
  not making the tree worse reached depth 5 with 44 nodes at best, so the
  level starts from another insertion order.

About half of all moves give back the same shape — a key in a leaf with room
goes back where it was. A move that changes nothing should say so, as the
demo's remove of a missing key does, rather than look like a move that failed.

### Open questions

- **Progress between goals.** Depth alone barely moves — no move on 10 or 14
  keys changes it — so the board should also show the node count: fewer nodes
  means fuller nodes, which is how the depth drops.
- **Where it lives.** The goal, the move count and the par are game state,
  not the versions demo's: a module of its own, with proofs that each
  level's goal is reachable and its par is what the level says.
