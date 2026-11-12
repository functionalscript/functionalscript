## Define resultStep before its callers

**Priority:** P2
**Status:** wip

### Problem

`step` and `catchStep` reference `resultStep` before its declaration, which
the FunctionalScript compiler refuses.

### Tasks

- [ ] Move the complete primitive and its documentation before its callers.
- [ ] Check full compiler admission and record the next refusal, if any.
- [ ] Run generation, type checking and the effects tests and coverage.
