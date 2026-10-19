## Par for the B-tree compaction game's depth-4 level

**Priority:** P3
**Status:** open

### Problem

The [game](../module.f.mjs) shows a par — the fewest moves from the start to
a perfect tree — at depths 2 and 3, and none at depth 4.

Its par is a breadth-first search over the move, which lists every tree
reachable from the start until one is perfect. At depth 3 that is thousands
of trees, searched in about a second, a few dozen trees a turn. At depth 4,
with 80 keys, the trees are too many to list, and the level is offered
without a par.

### What is not known

- **Whether a depth-4 start can always be made perfect.** At depths 2 and 3
  every random start searched reached the perfect tree. At depth 4 a random
  search from one start did not, which proves nothing either way. The game
  offers the level anyway, since a win is checked, not promised.
- **A method short of listing every tree:** a lower bound on the moves
  left (each move can fill at most so many nodes), a constructive sequence
  of moves that always reaches the perfect tree, or a search guided by such
  a bound instead of a blind one.

### Open questions

- Is a bound or a known-good sequence enough to show as par, or should the
  level show none until the exact fewest moves can be found?
