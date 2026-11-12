## Mock runner recursion

**Priority:** P2
**Status:** wip

### Problem

`runAll` captures `runner` inside its own call initializer, which the FJS
compiler refuses. `partialRun` uses the same pattern.

### Tasks

- Express the runners as recursive functions without changing state threading,
  result envelopes or handling of nested `all` effects.
- Check compiler acceptance, promote accepted modules and update references.
- Run scoped proofs, coverage and the required checks; record the next blocker.
