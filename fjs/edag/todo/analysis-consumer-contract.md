## analysis-consumer-contract. Share analyzed-node edges with consumer graph queries

**Priority:** P4
**Status:** wip — operand sharing is the final step.

### Problem

The analysis's private `refs` enumerates the entries a node references,
one per edge. The serializer's `allOperands` repeats that node-kind
knowledge for its graph queries: `reachableThrough`, `referencesWithin`,
`sharedWithin` and `references`. Keep that knowledge with the analysis
where a shared interface simplifies those consumers.

These walks have different boundaries. `refs` includes lazy edges and a
function's body, but omits primitive operands. The serializer's graph
queries stay within an invocation scope, following captures without
entering a nested function body. Its eager and lazy operand walks also
decide where code runs; they cannot be replaced indiscriminately by a
list of reference indices.

The serializer already uses the exported `mergeable` predicate. Its
`minting` helper is `!mergeable`, so shared calls and calling chains keep
their `const` as constructors do. This preserves call counts and identity;
replacing it with a predicate for only `[]`, `{}` and `=>` would change
behavior. The writer also already walks supported arithmetic operands,
including `+`.

### Completed binding composition

`checked(a, root?)` wraps the existing `bindingError` in
`Result<Analysis, string>`, returning the original analysis on success.
Its optional root preserves the selected-function check, including nested
bodies while excluding enclosing captures. It adds no validation rules.

`trySerialize`, `tryModuleSerialize`, `tryFunctionText`, the compiler's
Rust admission, `memo` and `validateClosure` use this helper at their
existing check sites. Memo uses `unwrap(checked(a))` so a refusal still
throws the original diagnostic string. Trusted result construction has
no new checks.

### Proposal

Share analyzed-node edge enumeration with the serializer's graph queries
without changing their results or scheduling. The API remains undecided:
exposing reference indices may suit counting, while other consumers need
operand positions or primitive operands. Preserve repeated edges, capture
edges, function-body boundaries and the distinction between eager and lazy
operands. Do not add a new validation pass or change which nodes are hoisted.

### Tasks

- [x] Add `checked(a, root?)` and route existing binding-check consumers
      through it, preserving success identity, selected scope and diagnostics.
- [ ] Share operand knowledge with consumer graph queries where it removes
      duplication. Prove preserved edge counts, scope boundaries and writer
      output; run the required checks.

### Related

- [identity-shared-walks.md](./identity-shared-walks.md) — the separate
  question of sharing source-object identity counts with Rust consumers.
- [Analysis](../analysis/module.f.mjs) — `refs`, `mergeable` and `checked`.
- [Serializer](../../compiler/serializer/module.f.mjs) — `allOperands` and
  the graph queries consuming it.
