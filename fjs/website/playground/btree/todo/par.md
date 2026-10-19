## Par for the B-tree compaction game

**Priority:** P3
**Status:** open

### Problem

The [game](../module.f.mjs) counts a player's moves but cannot say how good a
count is. A level's **par** — the fewest moves that make its starting tree
perfect — would say it, and the game has none yet.

### What is known

- **Depths 2 and 3 can have an exact par.** A breadth-first search over the
  move, from a start, lists every shape it reaches and stops at the first
  perfect one. At depth 2 a start reaches a handful of shapes; at depth 3
  thousands, which take most of a second in Node. In a page that is a long
  turn, so the search would run in steps, through a demo's `nextEvent`.
- **Every random start searched so far reached the perfect tree** at depths
  2 and 3, so a par exists there in practice; a proof that one always does
  is not known.
- **Depth 4 has no par, and maybe no win.** Its shapes are too many to list,
  and a random search from a start did not reach the perfect tree: whether a
  random 80-key start can always be made perfect is open. The game offers the
  level anyway, since winning is checked rather than promised.

### Open questions

- Is the search worth its cost per level, or should par be shown only once
  the player has won?
- At depth 4, is there a method short of listing every shape — a bound, or a
  constructive sequence of moves — or does the level stay without par?
