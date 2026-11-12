## Define walkStep before foldStep

**Priority:** P2
**Status:** wip

### Problem

`foldStep` references `walkStep` before its declaration, which the
FunctionalScript compiler refuses.

### Tasks

- [ ] Move the complete walker and its documentation before `foldStep`.
- [ ] Check compiler acceptance and promote accepted modules to `.f.js`.
- [ ] Run generation, type checking, scoped tests and coverage, and compilation.
