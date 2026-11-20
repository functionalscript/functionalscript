## Decide whether a diverging path may become a failing one

**Priority:** P3
**Status:** open

### Problem

[`unread`](../module.f.js) requires a recipe where it stands when nothing
after its declaration ends without having read it. A `continue` reached
unread counts as such an end, and no later read answers it: that path may
loop forever, and requiring the recipe would turn it into a failure where
the recipe fails.

The spec's
[failure principle](../../../../../spec/principles/README.md#failure-is-one-outcome)
speaks of paths that complete. A path that never ends does not complete, so
the principle as written allows the stronger rule: drop a `continue` at its
loop, and by induction over passes only the paths to a `break` count. A loop
that reads the recipe before every `break` would then be read on every path.

Nothing measured needs the stronger rule; `fjs compile fjs/module.f.js`
writes FunctionalScript without it.

### Tasks

- [ ] The language designer decides whether divergence may become failure.
- [ ] If it may, drop `continue L` at loop `L` in `unread`.
