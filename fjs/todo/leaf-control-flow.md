# Make leaf control flow compile

**Status:** wip

The remaining `module.f.mjs` leaves contain conditional joins of several outer
bindings, closures over reassigned state, and switch branches without a
terminator. Rewrite these constructs using the current FJS language while
preserving their behavior.

## Tasks

- Rewrite conditional joins, closure captures, and non-terminating switches in
  current leaves.
- Rename modules accepted whole to `.f.js` and update their references.
- Run scoped proofs and coverage, type checking, generation, and the compiler
  and website checks required by the resulting changes.
