# Rewrite unsupported constructs in the next leaf modules

**Priority:** P3
**Status:** wip

## Problem

The leaves exposed by #3888 still contain unsupported computed/property reads
and may contain Array.from, forward references, or captured reassigned bindings.
These source constructs can be rewritten with existing FJS operations.

## Tasks

- Audit the current leaves and replace the requested constructs while preserving behavior.
- Promote whole compiler-accepted modules to `.f.js` and update their references.
- Verify scoped proofs and coverage, type checking, compilation, and affected demos.

The identity-sensitive grammar cycles remain tracked in
[`recursive-rule-forward-references.md`](../ebnf/lib/todo/recursive-rule-forward-references.md).
