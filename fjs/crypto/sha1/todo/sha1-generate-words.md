## Generate block words by index

**Priority:** P2
**Status:** wip

### Problem

`words` uses the reserved global `Array.from` to generate sixteen words by
index. The existing `types/array/generate` helper has the same behavior for
this fixed length and index-only callback.

### Tasks

- [ ] Use `generate(16, i => ...)` and refresh the shared-word TODO example.
- [ ] Check compiler acceptance and record the next blocker, if any.
- [ ] Run type checking and the SHA-1 tests and coverage.
