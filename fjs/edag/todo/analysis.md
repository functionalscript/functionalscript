## EDAG analysis: the nodes to memoize, as one table for a writer and a VM

**Priority:** P2
**Status:** open

### Problem

Three consumers of an EDAG have to know which nodes are shared, and none of
them can ask the graph directly.

- The FunctionalScript writer
  ([`fjs/fsc/todo/functionalscript-output.md`](../../fsc/todo/functionalscript-output.md))
  hoists a shared node into a `const $n`, and the DataJS writer refuses JSON
  for one.
- A JavaScript-compatible executor
  ([`../execution-models.md`](../execution-models.md) §2) evaluates a shared
  node once per scope and reuses the value, so that `[s, s]` holds one array
  as JavaScript's does; [`amnesia`](../amnesia/README.md) deliberately does
  not, and evaluates it once per edge.
- The `fjs compile` value outputs decide sharing on the AST today, by a
  sweep in [`fjs/fsc/ast`](../../fsc/ast/module.f.mjs) that follows references
  and access keys, because the value path has no graph to read.

Sharing in an EDAG is node identity, which a walk can only see with a memo
of its own — `validate` re-walks a shared subgraph once per edge for that
reason — and the language forbids the mutable set a naive walk would keep.
So the decision is made ad hoc: the DataJS serializer numbers nodes into a
table by its own walk, the AST sweep follows routes, and an executor would
build a third notion. Node identity is also not the whole of sharing:
`[cfg.a, cfg.a]` is two access nodes and one value, which the AST sweep
knows by its keys and an identity count does not.

### Proposal

One pure module, `fjs/edag/analysis`, that reads an EDAG and returns what
every consumer needs, in a form that needs no identity-keyed structure
downstream:

```ts
type Analysis = {
    readonly nodes: readonly Exp[]      // every node, in evaluation order, each once
    readonly shared: readonly number[]  // the indices reached by more than one edge, in that order
    // per function body: the same, scoped — a body's table is its own
}
```

- **Counted per scope.** The `=>` boundary is the scope: a module-level node
  shared by the program is computed once per program, a node shared inside a
  body once per call, and nothing crosses the boundary, which the compiler's
  scope rule guarantees. So each function body has its own table, and a
  shared node is "this node, in this scope".
- **Merged before counted.** A node whose result identity is decided by its
  inputs — an access, an operator, the comma — is the same node as another
  spelled the same over the same inputs, so `[cfg.a, cfg.a]` becomes one
  node reached twice. A constructor, `[]`, `{}` or `=>`, mints identity and
  is never merged: two `[]` are two arrays. This is the content-addressed
  reading of the graph, and it is what lets the EDAG-backed outputs retire
  the AST's route sweep.
- **Laziness respected.** A node under a lazy position — the right operand of
  `&&`, `||`, `??`, a function body — is memoized when first demanded, never
  before; the table records sharing, the executor decides when.
- **Numbered, not keyed.** The table is built as the DataJS serializer builds
  its graph, a finished list numbered once, so no consumer holds a `Map` by
  object: the writer takes its `$n` names from the index, and the executor
  indexes its cache by integer.

Two consumers then follow, and share amnesia's operations:

- **`fjs/edag/memo`**, a JavaScript-compatible executor: the EDAG and its
  analysis in, a value out, each shared node evaluated once per scope and its
  value reused. Amnesia's per-tag operations become a table both executors
  read, parameterized by how a child is evaluated — amnesia recurses, the
  memo executor looks the child up and records it — so the two agree on every
  value and amnesia stays the proof oracle, never the executor
  ([`../execution-models.md`](../execution-models.md) §2.2).
- **The writers**: the FunctionalScript writer hoists exactly `shared` as
  `const $n`, in table order, and the DataJS writer refuses JSON when `shared`
  names a container.

The table replaces, for the EDAG-backed outputs, the sharing sweep in
`fjs/fsc/ast`, whose route-following becomes the merge step here; the value
outputs keep it until they read the EDAG.

### Tasks

- [ ] `fjs/edag/analysis`: the table over an `Exp` — nodes in evaluation order,
      shared indices, one table per function body — with the merge of
      identity-free nodes and no merge of constructors; proofs for a shared
      constructor, a shared access, two equal accesses, two equal constructors,
      sharing inside a body against sharing outside, and a lazy operand.
- [ ] Amnesia's operations factored into a table parameterized by the child
      evaluation, amnesia unchanged in behavior and its proofs green.
- [ ] `fjs/edag/memo`: the executor over the table, with proofs that `[s, s]`
      holds one array, that a body's node is fresh per call, and that a lazy
      operand is evaluated only when demanded — each beside amnesia's answer.
- [ ] The writers read the table: `functionalscript-output.md`'s `$n` hoisting
      from `shared`, the DataJS writer's JSON refusal from it.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [`../execution-models.md`](../execution-models.md) — §2.2 is this analysis,
  §2.3 the writer over it.
- [`../amnesia/README.md`](../amnesia/README.md) — the operations both
  executors share, and why amnesia itself stays an oracle.
- [`fjs/fsc/todo/interpret-edag.md`](../../fsc/todo/interpret-edag.md) — the
  interpreter plan, whose per-invocation memoization this table serves.
- [`fjs/fsc/todo/functionalscript-output.md`](../../fsc/todo/functionalscript-output.md)
  — the writer that hoists `shared`.
- [`fjs/media/datajs/serializer`](../../media/datajs/serializer/module.f.mjs) —
  the numbering technique, a finished list and one `Map`, reused here.
