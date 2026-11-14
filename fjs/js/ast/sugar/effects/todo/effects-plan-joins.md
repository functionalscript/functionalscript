## Return one source-effects plan

**Priority:** P2
**Status:** wip

### Problem

`writes` in [the effects module](../module.f.mjs) conditionally updates
multiple outer bindings while planning child traversal. The FJS compiler
admits only one outer-binding join for an ordinary conditional.

### Tasks

- [ ] Extract `planFor(node, functions)` returning `children`, `own` and
      `opaque`, with early returns for array cases and local block accumulators.
- [ ] Preserve traversal order, binding identity and held-function boundaries.
- [ ] Check compiler acceptance, scoped proofs, coverage, types and demos;
      promote the module if it compiles whole.
