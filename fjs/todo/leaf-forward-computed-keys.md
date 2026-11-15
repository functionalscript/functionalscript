# Resolve forward references and computed keys in leaf modules

**Priority:** P3
**Status:** wip

The remaining `module.f.mjs` leaves include forward references and computed
keys outside the compiler's accepted syntax. Resolve those blockers while
preserving evaluation order, callback behavior and public data shapes.

## Tasks

- Audit leaf implementations for forward references and computed keys.
- Rewrite those accesses and dependencies using existing FJS constructs.
- Rename accepted modules to `.f.js` and update their references, repeating
  the audit for newly exposed leaves.
- Verify affected proofs, coverage, types, compilation and website demos.
