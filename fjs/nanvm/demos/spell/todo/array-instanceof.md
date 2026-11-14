## Classify FJS arrays with instanceof

**Priority:** P2
**Status:** wip

### Problem

The demo value speller extracts `isArray` from `Array`, which the FJS compiler
does not admit. Its FJS values can be classified with `value instanceof Array`.

### Tasks

- [ ] Replace the array predicate while preserving the existing null check.
- [ ] Check compiler admission and rename the module to `.f.js` if accepted.
- [ ] Verify proofs, coverage, types and affected demo behavior.
