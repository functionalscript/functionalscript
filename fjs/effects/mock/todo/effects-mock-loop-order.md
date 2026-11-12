## Define the interpreter loop before its callers

**Priority:** P2
**Status:** wip

### Problem

`run` and `partialRun` reference `_loop` before its declaration, which the
FunctionalScript compiler refuses.

### Tasks

- [ ] Move the complete helper and its documentation before both callers.
- [ ] Check compiler acceptance and promote the module to `.f.js` if accepted.
- [ ] Run generation, type checking and the affected tests and coverage.
