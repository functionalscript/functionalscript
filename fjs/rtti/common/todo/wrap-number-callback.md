## Wrap the numeric key conversion

**Priority:** P2
**Status:** wip

### Problem

`readIndices` passes the bare `Number` global to `map`, which the
FunctionalScript compiler refuses as a value.

### Tasks

- [ ] Use `v => Number(v)` while preserving the array-index results and order.
- [ ] Check the full module and record its next refusal, if any.
- [ ] Run type checking and the scoped RTTI tests and coverage.
