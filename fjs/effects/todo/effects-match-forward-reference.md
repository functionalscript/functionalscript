## Define the shared matcher before its callers

**Priority:** P2
**Status:** wip

### Problem

`match` and `partialMatch` reference `_matchWith` before its declaration.
The FunctionalScript compiler refuses that dependency order.

### Tasks

- [ ] Move the shared helper and its documentation before the public callers.
- [ ] Check full compiler acceptance and promote accepted modules to `.f.js`.
- [ ] Run generation, type checking and the affected tests and coverage.
