## EDAG computation graph visualizer

**Priority:** P4
**Status:** open

### Problem

A function's EDAG is a **DAG whose sharing is semantic**
([edag-stage1-discussion](./edag-stage1-discussion.md), subject 1): a
node referenced twice is evaluated once, and `[x, x]` is a different
function from `[{}, {}]`. Every textual view hides exactly that:

- source text — the sharing shows only as `const` bindings, and two
  functions that read identically can differ in which nodes are shared;
- JSON — expands sharing entirely ([spec/README.md](../spec/README.md)),
  so it cannot even represent the graph;
- DJS — preserves sharing, but a reader must reconstruct the graph
  mentally from the `const` names.

Reviewing an EDAG design, explaining it, or debugging *why two functions
hash differently* all want the graph itself.

### Proposal

A pure function from an EDAG value to a graph description — data in,
text out, no side effects, so it is ordinary FunctionalScript and can
eventually be part of the self-hosted toolchain.

Output formats worth supporting:

- **Mermaid** — renders inline in Markdown, GitHub, and published
  artifacts; the natural default for design documents like this one;
- **Graphviz DOT** — better layout for large graphs, and the input other
  tooling expects.

What the rendering must show, beyond a plain tree:

- **shared nodes appear once, with several in-edges** — the whole point;
  a renderer that duplicates them defeats the purpose;
- **operand roles**, not just edges: `","`'s assert operands vs. its
  result, and which operand positions are **lazy** (`"&&"`, `"||"`,
  `"??"`, `"?:"`);
- **leaves** distinctly: constants inline in the node, and fixed `["arg", N]`,
  `["rest"]`, `["frame"]` and module-import `["args"]` as marked terminals;
- **nested functions as clusters**: an `["=>", length, frame, body]` node draws
  its body as a subgraph, with edges from the enclosing scope into the
  frame — making the closed-scope model visible (a body's only inbound
  edges are its frame). `length` is metadata on the function node.

### Current fixed/rest format

The compiler and evaluators implement the fixed/rest format in #2237. The old
three-element function tuple and function-owned `['args']` are historical;
they are not an alternative schema for this visualizer. Follow the
[named-and-rest parameter plan](../spec/todo/3120-parameters.md#edag-fixed-prefix-and-rest)
for the current format. This TODO's Mermaid/DOT rendering and proof requirements
remain open; the format's implementation does not complete this visualizer task.

For `['=>', length, frame, body]`, show `length` as function metadata,
not an evaluated operand or edge. Mark `['arg', N]` and `['rest']` as
terminals of the owning invocation; `N` is metadata bounded by that
function's length. Retain the `['frame']` terminal; `['self']` remains a future
terminal when that node is supported, not a currently admitted function binding.
The frame operand stays in the enclosing scope; only the body opens a
new function cluster. A nested function's frame can therefore read its
parent's fixed/rest bindings without assigning them to the child's scope.

Unresolved modules retain module-owned `['args']` for imports, including
reads in module-level closure frames. Do not rename those to `['rest']`
or expose a complete-list `['args']` terminal inside a function body.
Use the parameter plan's scope validation rather than a second schema.

Before completing this visualizer task, add rendering proofs for positive-arity
fixed/rest functions, zero-arity rest-only functions, and nested closures
capturing outer parameters/rest or module imports. Check metadata labels,
scope placement and shared-node identity. Unsupported node forms must be
refused explicitly, not silently omitted or reinterpreted as old tuples.

### Uses

- reviewing EDAG designs and teaching the format;
- debugging hash mismatches — two functions that look the same in source
  but differ in sharing are obvious side by side as graphs;
- inspecting compiler output: what the lowering of `if`, `assert`, or a
  closure actually produced.

### Related

- [edag-spec](./edag-spec.md) — the RTTI schema of the format.
- [edag-stage1-discussion](./edag-stage1-discussion.md) — the format
  being visualized, and where its semantics are worked out.
- `toString(f)` is the *text* counterpart of the same data; the two
  together cover both audiences.
