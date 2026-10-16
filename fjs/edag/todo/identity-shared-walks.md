## Investigate shared identity traversal

**Priority:** P4
**Status:** open

### Problem

[`analysis`](../analysis/module.f.mjs) builds a table that merges
structurally equal identity-free nodes within each scope, and
`identityAnalysis` one that merges nothing. The Rust printer in
[`edag/rust`](../rust/module.f.mjs) works with source-node identity and
uses the parameterized `visit` of [`sharing`](../sharing/module.f.mjs) for
counts and graph queries.

**The writers' part is done.** Which nodes are shared is one count for
both writers, by source identity: `visit` and `sharedNodesOf` live in
[`sharing`](../sharing/module.f.mjs), which the Rust printer imports, and
the FunctionalScript writer writes from `identityAnalysis`, whose shared
entries are what `sharedNodesOf` lists in each scope. The owner's call:
"we have to fix a bug in shared serializer code, that must be used by both
`JS` and `Rust`". What a writer names stays its own: the Rust printer
gives an unshared operation a `let` too — `a => (a + a) + (a + a)` binds
each `a + a` — where the FunctionalScript writer names a shared node and
writes an unshared one in place. Whether more traversal machinery can be
shared without complicating its consumers remains an optional
investigation.

`sharing`'s `operandsOf` walks source `Exp` operands and includes only
function captures, while `analysis.operandsOf` walks analyzed `Node`
operands and includes captures followed by the body.

[`compiler/rust`](../../compiler/rust/module.f.mjs) already delegates
binding generation to `edag/rust.scope`; it analyzes the graph for admission
and does not maintain another binding walk. The same `visit` supports
`sharedNodesOf` in `sharing` and, within `edag/rust`, argument and frame
reads, function detection, and the printer's binding decisions, with
different boundaries:

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

- [ ] Identify whether the shared walk would simplify the other
      consumers — `analysis`'s `Node` walk, the printer's other queries,
      `fjs/nanvm/rust`'s `reaches`. Preserve source identity, repeated
      edges, dependencies before dependents, scope boundaries,
      caller-supplied bindings, and eager/lazy ownership.
- [ ] If a simpler implementation emerges, prove those contracts against
      the existing Rust sharing and lazy-block cases, including distinct
      structural-twin parents of one constructor. Regenerate and verify
      unchanged Rust output and run the required checks. Otherwise record
      why the separate representations need their current walks and retire
      this issue.

### Related

- [`../sharing/module.f.mjs`](../sharing/module.f.mjs) — the writers'
  shared sharing count.
- [analysis.md](./analysis.md) — the merged table's sharing contract.
- [`../rust/proof.f.mjs`](../rust/proof.f.mjs) — source-identity counts,
  dependency order, function scopes and lazy-block ownership.
- [`../rust/todo/let-bindings-owner.md`](../rust/todo/let-bindings-owner.md) —
  ownership of binding output, a separate question from traversal.
