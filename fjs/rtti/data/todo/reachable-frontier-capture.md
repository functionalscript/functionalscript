## Capture reached rule names through an immutable binding

**Priority:** P2
**Status:** wip

### Problem

`reachableFrom` filters the next frontier with a callback that captures the
reassigned `result` variable, preventing FJS compiler admission.

### Tasks

- [ ] Capture `result` as `const reached` inside each loop iteration and read
      that snapshot in the filter, avoiding shadowing the callback parameter.
- [ ] Check compiler admission and promote the module to `.f.js` if accepted.
- [ ] Verify the existing RTTI proofs, coverage, types and affected demos.
