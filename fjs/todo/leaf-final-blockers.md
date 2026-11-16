# Resolve leaf control-flow and access blockers

**Priority:** P2
**Status:** wip

## Problem

The latest leaf audit on PR #3923 reports five `.f.mjs` modules whose first
compiler blockers are ordinary conditional joins, assignment through a captured
binding, function-name access, computed array indexes and array iterators.

The owner requested fixes in a new PR in the
[working session](https://chatgpt.com/local/6af76317-5c08-8191-b451-685c94478033).
Use existing FJS constructs and preserve each module's documented behavior.

## Tasks

- [ ] Rewrite the syntax reader's joined `declaration` and `classic` bindings.
- [ ] Return EDAG-to-FAST's terminal result without assigning a captured binding.
- [ ] Replace the schema demo's prohibited function-name access.
- [ ] Make changelog array indexes explicitly numeric.
- [ ] Replace the README renderer's array iterator with an admitted traversal.
- [ ] Promote whole modules the compiler accepts and update their exact references.
- [ ] Run scoped proofs and coverage, types, generation, source admission and
      relevant browser checks; record the new leaf table.
