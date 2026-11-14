## Capture each generated identifier candidate immutably

**Priority:** P2
**Status:** wip

### Problem

The generated-name collision check captures reassigned `id` in a `.some`
callback, preventing compiler admission of the TypeScript renderer.

### Tasks

- [ ] Bind `const id0 = id` before each collision check and use `id0` in the
      callback, preserving candidate advancement and name allocation.
- [ ] Check compiler admission and promote accepted modules to `.f.js`.
- [ ] Verify existing collision proofs, coverage, types and affected demos.
