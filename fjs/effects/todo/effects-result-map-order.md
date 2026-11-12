## Define resultMapStep before mapStep

**Priority:** P2
**Status:** wip

### Problem

`mapStep` references `resultMapStep` before its declaration, which the
FunctionalScript compiler refuses.

### Tasks

- [ ] Move the complete result mapper and its documentation before `mapStep`.
- [ ] Check full compiler admission and record the next refusal, if any.
- [ ] Run generation, type checking and the effects tests and coverage.
