## Draw Mermaid diagrams on the site

**Priority:** P4
**Status:** open

### Problem

GitHub draws a README's `mermaid` fence as a diagram; the site shows its
source as a code block ([`readme`](../readme/module.f.mjs)'s `readmeNodes`).
GitHub draws `geojson`, `topojson` and `stl` fences too, but no README uses
one.

**Showing the source is the right default until the site can draw.** A Mermaid
fence shown as code is the author's own text, character for character: the
same content in a less convenient form, not a plausible wrong value
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
refuses. Refusing the README instead was proposed and closed
([#3386](https://github.com/functionalscript/functionalscript/pull/3386)):
it would hide every other paragraph of the README to avoid a difference that
misleads no one.

At `92d8e4a1`, two rendered READMEs hold Mermaid fences:
`doc/sergey/disot/README.md` holds eight flowcharts, and
`fjs/js/runtime/README.md` holds a flowchart and a sequence diagram.

### Proposal

**Draw them ourselves, at build time, with the renderer the site already
has.** [`demo/graph`](../demo/graph/module.f.mjs) lays out and draws a node and
edge diagram as SVG (`ranked`, `graphSvg`), as Graphviz's `dot` does, and
[graph-visualizer](../../edag/todo/graph-visualizer.md) already asks for it to
be reused. A README is rendered when the site is built, so a diagram drawn
there reaches a reader without JavaScript too.

Depending on Mermaid itself was considered and set aside. It would be the
repository's first runtime dependency, which
[AGENTS.md §6](../../../AGENTS.md#6-external-tools) asks approval for. It
draws in the browser, so without JavaScript a reader would still see source,
and drawing at build time would put a headless browser in the generator. Its
one advantage is GitHub's exact picture, for every kind of diagram.

**A subset, refused fence by fence.** Read the flowchart forms the READMEs
use: a `flowchart` header with its direction, a node as `id` or `id["label"]`,
an edge as `-->` or `-->|label|`, a chain `a --> b --> c`, and `<-->`. Any
other kind of diagram or form keeps its fence as source, as today; one fence
outside the subset never costs the README its other diagrams.

A throwaway prototype at `92d8e4a1` fed the README flowcharts into
`graphSvg` unchanged. Most drew cleanly; what the rest need is in the tasks
below. Every diagram is drawn left to right, so a `TD` flowchart turns
sideways: its picture changes direction, not its content.

### Tasks

- [x] A reader for the flowchart subset, as a FunctionalScript module with its
      proof: text in, nodes and edges out, or the refusal of a form outside
      the subset ([`media/mermaid`](../../media/mermaid/module.f.js)'s
      `tryFlowchart`).
- [x] Mark an edge that closes a cycle as a `back` edge, so the layout ranks
      the rest: `disot`'s document → hash → document drew badly without it
      ([`mermaid`](../mermaid/module.f.mjs)'s `flowchartGraph`; `ranked` in
      `demo/graph` starts every source at rank 0, so a flowchart with
      several starting points ranks them all).
- [x] Draw a node's label of several lines: the reader reads Mermaid's
      `<br>`, `<br/>` and `<br />` as `\n`, and `demo/graph` stacks a
      label's lines. A `\n` written in a label is no line break Mermaid
      documents, so the reader refuses one; `doc/sergey/disot`'s labels
      spell their breaks `<br/>`, and every one of its flowcharts draws. An arrow
      with no label beside labelled ones is a row naming its target, as the
      renderer draws one; an arrow label of several lines is refused, as a
      row is one line.
- [x] Mermaid's entity codes in a label: the reader reads `#lt;`, `#gt;`,
      `#amp;` and `#quot;` as the characters they name, and refuses any
      other `#`, a decimal code such as `#35;` among them.
      `fjs/js/runtime`'s flowchart spells `runtime::<A>()` as
      `runtime::#lt;A#gt;()`, which GitHub shows as written and the site
      draws; as `<A>`, Mermaid read a tag and GitHub dropped it.
- [x] Draw a README's flowchart fence as its diagram in
      [`readme`](../readme/module.f.mjs), and keep any other fence as source.
- [ ] Sequence diagrams: a layout of their own, if a second README wants one.

### Related

- [render-readme](render-readme.md): the README renderer this extends.
- [graph-visualizer](../../edag/todo/graph-visualizer.md): wants Mermaid
  output for EDAG graphs, and the same renderer.
