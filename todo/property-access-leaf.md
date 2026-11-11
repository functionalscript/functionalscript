# Compile EDAG value property lookup

**Priority:** P2
**Status:** wip

## Problem

`edag/value/property` is a runtime dependency leaf whose numeric element
lookup does not use the compiler's admitted `Number(...)` spelling.

## Direction

Use admitted access syntax without changing indexed lookup, stored-value
identity, function length, entry presence or failure behavior. Compile the
whole module, migrate accepted sources to `.f.js`, then repeat dependency
discovery to a rename-only fixed point.

## Tasks

- [ ] Update and compile property lookup with its existing semantic proofs.
- [ ] Rename accepted sources and update their references.
- [ ] Refresh the leaf audit, regenerate outputs and run scoped checks.
