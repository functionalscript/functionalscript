## Admit plain while loops at module level

**Priority:** P2
**Status:** wip

### Problem

Plain source loops support zero or multiple state values in function, guard and
case bodies, but module statements still refuse `while`. General bindings and
the shared FAST state/result path already treat module execution as one scope.

### Proposal

Admit the existing plain `while` grammar among module statements, including
between named exports. Reuse function-body loop resolution and normalization;
preserve module initialization order, export snapshots, lexical scopes,
required failures and write-based capture checks. Default export and terminal
throw keep their current placement rules. Structured/nested loop bodies and
explicit loop exits remain later H increments.

This completes the module-placement portion of the approved
[general-loop proposal](../../../../spec/todo/3220-let.md#general-loops).
The benefit is ordinary top-level loop initialization with the existing
immutable graph/output pipeline; the cost is extending module statement
admission and proving its interaction with imports and exports.

### Tasks

- [ ] Admit and resolve module loops through the shared loop owner.
- [ ] Prove snapshots, captures, scopes, initialization/failure ordering and
      sequential/zero/wide state through source and graph conversions.
- [ ] Check deep JavaScript/Rust execution, source fixed points and migration
      candidates newly admitted by the grammar change.
- [ ] Update the module/loop specifications and affected browser demos.

### Related

- [General loops and tail calls](../../../todo/general-loops-and-tail-calls.md)
