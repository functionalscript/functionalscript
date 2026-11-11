# Remove forward references from sharing and value schemas

**Priority:** P2
**Status:** wip

### Problem

The remaining `edag/sharing` and `edag/value` dependency leaves are blocked by
forward references. Sharing's ordinary and eager operand selectors refer to
each other; the evaluated-value schema refers to its later array, object and
function forms.

### Direction

Factor the shared operand-selection rules into earlier helpers, and build
recursive value schemas from an already-bound self thunk. Preserve operand
order, lazy positions, public exports, precise recursive types and accepted
value shapes. Document fresh internal descriptor identities where applicable.

### Tasks

- [ ] Remove the two modules' forward references and prove their behavior.
- [ ] Compile and rename accepted modules; update their references.
- [ ] Refresh the leaf audit and complete generation and scoped checks.
