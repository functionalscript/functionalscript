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
- **leaves** distinctly: constants inline in the node, and `["args"]`,
  `["frame"]`, `["self"]` as marked terminals;
- **nested functions as clusters**: an `["=>", frame, body]` node draws
  its body as a subgraph, with edges from the enclosing scope into the
  frame — making the closed-scope model visible (a body's only inbound
  edges are its frame).

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
