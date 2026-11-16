# Resolve the current leaf compiler blockers

**Status:** wip

The eight current `.f.mjs` leaves stop at forward references, a computed
numeric index, `Array.from`, `Array.isArray`, or a bare `String` callback.
Rewrite the listed constructs without changing behavior, then promote each
module the current compiler accepts whole to `.f.js`.

## Tasks

- Resolve `nameText`, `block`, and `valueBranches` forward references.
- Mark the numeric operand index in `edag/to_fast/join`.
- Replace index-generating `Array.from` calls with the shared generator.
- Use `instanceof Array` in `nanvm` and wrap the versions `String` callback.
- Update references for compilable modules and validate the changed scopes.
