## Draw the source AST and FAST side by side

**Priority:** P3
**Status:** wip

### Problem

The compiler holds a module as two trees before the EDAG. The parser produces
the **source AST** (`SourceModule`, [`../sugar/source.ts`](../sugar/source.ts)),
and `normalize` ([`../sugar/module.f.mjs`](../sugar/module.f.mjs)) expands it
into **FAST** ([`../types.ts`](../types.ts)). Neither tree can be seen as a
graph:

- the [parser demo](../../../compiler/parser/demo.f.mjs) prints the source
  AST as DataJS text, so a reader has to work out from the indices which
  references are the same binding;
- FAST has no page at all. The website shows tokenizer, parser, EDAG and
  outputs, and skips the stage between parser and EDAG where most of the
  semantics are decided: logical operators become conditionals, `let` and
  `while` become `loop` parameters and results, and closures get explicit
  captures.

What `normalize` does is easiest to see by comparing its input with its
output, and a text listing of either tree hides the parts that matter:
binding identity, laziness and exit targets.

### Proposal

One demo page in `fjs/js/ast/` that parses the module, normalizes it, and
draws both trees with the shared renderer,
[`fjs/website/demo/graph`](../../../website/demo/graph/module.f.mjs).

```text
Demo
  lead
  examples ▾          ← the shared compiler presets, fjs/compiler/examples
  [ module source ]
  ### Source AST      ← graph of the parser's ResolvedModule
  ### FAST            ← graph of normalize's Module
```

The lead says what the two panes are and how to read the drawing: a binding
is one node however many places read it, a dashed edge is an operand that may
never be evaluated, and a back edge points to the function or loop that an
exit targets.

**Each pane runs the real stage.** The page calls the parser's own entry, as
[`stage_demo`](../../../compiler/stage_demo/module.f.mjs)'s `parsed` does,
and then `normalize`, as the [EDAG lowering](../../../compiler/edag/module.f.mjs)
does. It copies no stage logic. Imports become placeholder values passed to
`normalize`, so they appear as FAST module parameters.

**Refusals are shown in each stage's own words.** A parse error replaces both
panes with the parser's message. A module that parses but that `normalize`
refuses keeps its source drawing, and the FAST pane shows the refusal.

**Under each graph, a collapsed DataJS listing of the same tree**, so the
drawing can be checked against the exact structure.

#### Shapes

The two trees share their structure: `SourceOperator<V>` is `Operator<V>`
plus the logical binaries, and both sides have blocks, statements, exits,
loops and functions built the same way. The shapes follow that:

- one `Shape` function for the common part (`Operator<V>`, `Step<V>`,
  `Item<V>`, `Entry<V>`, `Key<V>`), generic over the operand, in
  `fjs/js/ast/`. The [EDAG demo](../../../compiler/edag/demo.f.mjs) already
  draws these operators, chains included: the EDAG spells them with the same
  tuples except for the array and object tags (`'[]'`/`'{}'` there,
  `'array'`/`'object'` in FAST). So the shape is extracted from that demo,
  parameterized by the two tags, and the EDAG demo uses it too, rather than
  a second drawing of the same operators being written;
- a FAST walker in `fjs/js/ast/` and a source walker in `fjs/js/ast/sugar/`,
  each adding only its own forms.

What the drawing shows:

| Thing | Drawn as |
| ----- | -------- |
| block | a node with one row per statement and an `exit` row |
| binding (`BindingId`) | one node per identity, labeled with its source name from the parser's `origins`, or `#index` for a compiler temporary |
| operator | a node labeled with its tag, one port per operand |
| primitive | inline in its parent's port |
| lazy operand, `lazy` define | `lazy` edge, drawn dashed |
| `return`, `break`, `continue` | `Back` edge to the function or loop it targets |
| function | a node with `parameters`, `rest`, `self`, `captures` and `body` ports; source `length` as metadata |

Binding identity is the reason to draw these trees: `BindingId` is compared by
object identity, so the renderer's `Object.is` walk draws a binding as one
node with an in-edge from every declaration, read, write and capture. A
generic value walk would draw each `{ index }` record as a separate node,
which is exactly what the DataJS text already shows.

An unknown node form is refused with an explicit message, never left out of
the drawing.

### Tasks

- [ ] The shared `Operator<V>` shape, extracted from the EDAG demo with its
      proofs, and the EDAG demo drawing through it unchanged.
- [ ] The FAST walker, with its proof: shared bindings, lazy defines,
      captures, loops with their exits, `return` to an outer function.
- [ ] The source walker, with its proof: the logical binaries, expansion
      plans, `initialize`/`write`, `while`, `switch`.
- [ ] The demo page with both panes, the refusals and the DataJS listings;
      its proof walks the shared presets.
- [ ] Decide whether the parser demo keeps its DataJS listing or points here.

### Related

- [`fjs/edag/todo/graph-visualizer.md`](../../../edag/todo/graph-visualizer.md):
  the same drawing one stage later, for the EDAG.
- [`fjs/compiler/todo/output-demos.md`](../../../compiler/todo/output-demos.md):
  the stage pages this page joins.
- [`fjs/website/demo/README.md`](../../../website/demo/README.md): how a
  demo looks.
