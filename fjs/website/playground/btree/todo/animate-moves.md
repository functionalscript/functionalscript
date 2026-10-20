## Show a move in two steps

**Priority:** P3
**Status:** wip

### Problem

A move in the [game](../module.f.mjs) — a key removed and inserted again —
jumps straight to its result. The player sees the new shape but not why: a
remove that empties a leaf merges or borrows, and the insert that follows
can split somewhere else. That is the lesson of the game, and the drawing
skips it.

### Plan

- **The game shows the tree halfway**: right after the remove, with the key
  lifted out, then after a pause the tree with the key inserted again. The
  halfway tree is game state, so its proofs check it like any other.
- **The demo runtime waits between them.** A demo's `nextEvent` asks for an
  automatic event, which the runtime runs at once; an optional
  `nextDelay(state)` says how long to wait first. Scheduling is the
  runtime's job, not an effect, so no operation is added.
- **A click during the pause lands the move first**, since a reader's event
  cancels the scheduled one; a new tree or level drops it.
