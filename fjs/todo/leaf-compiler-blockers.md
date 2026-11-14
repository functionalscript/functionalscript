# Resolve remaining leaf compiler restrictions

**Priority:** P3
**Status:** wip

## Problem

The leaves remaining after #3885 contain Array.from calls, forward references,
computed or prohibited properties, and callbacks capturing reassigned bindings.

## Tasks

- Replace these constructs with existing FJS operations while preserving behavior.
- Rename complete compiler-accepted modules to `.f.js` and update their references.
- Run scoped proofs and coverage, type checking, compilation, and affected demos.

## Related

- Stacked on #3885.
