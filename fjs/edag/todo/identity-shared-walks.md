## Investigate shared identity traversal

**Priority:** P4
**Status:** open

### Problem

[`analysis`](../analysis/module.f.mjs) builds a table that merges
structurally equal identity-free nodes within each scope. The Rust printer
in [`edag/rust`](../rust/module.f.mjs) works with source-node identity and
uses its parameterized `visit` for counts and graph queries. Whether some
traversal machinery can be shared without complicating either consumer
remains an optional investigation.

[`compiler/rust`](../../compiler/rust/module.f.mjs) already delegates
binding generation to `edag/rust.scope`; it analyzes the graph for admission
and does not maintain another binding walk. Within `edag/rust`, the same
`visit` supports `sharedNodesOf`, argument and frame reads, function
detection, and the printer's binding decisions, with different boundaries:

- A scope follows a function's captures but leaves its body to a separate
  invocation. Whole-program function detection includes bodies.
- The printer stops descending at values the caller has already bound.
- Lazy-block ownership compares counts under the scope root and under
  individual thunk roots, together with eager reachability. Chain argument
  lists are thunk roots whose items are walked without treating the list
  itself as an expression node.

A single global list of shared source objects cannot replace these queries.
The analysis's merged table is also a different answer from source-identity
counts: distinct structural-twin parents can both reference one constructor,
and that constructor must retain its sharing when printed.

`fjs/nanvm/rust`'s `reaches` has a separate purpose: it checks whether a
group uses a named value from `data.shared`. That value needs its supplied
binding even when reached once; this is not a repeated-edge count.

### Tasks

- [ ] Identify whether a common traversal contract would simplify the
      current consumers. Preserve source identity, repeated edges,
      dependencies before dependents, scope boundaries, caller-supplied
      bindings, and eager/lazy ownership. No shared API is chosen yet.
- [ ] If a simpler implementation emerges, prove those contracts against
      the existing Rust sharing and lazy-block cases, including distinct
      structural-twin parents of one constructor. Regenerate and verify
      unchanged Rust output and run the required checks. Otherwise record
      why the separate representations need their current walks and retire
      this issue.

### Related

- [analysis.md](./analysis.md) — the merged table's sharing contract.
- [`../rust/proof.f.mjs`](../rust/proof.f.mjs) — source-identity counts,
  dependency order, function scopes and lazy-block ownership.
- [`../rust/todo/let-bindings-owner.md`](../rust/todo/let-bindings-owner.md) —
  ownership of binding output, a separate question from traversal.
