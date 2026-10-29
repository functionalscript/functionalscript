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

One demo page that parses the module, normalizes it, and draws both trees
with the shared renderer,
[`fjs/website/demo/graph`](../../../website/demo/graph/module.f.mjs). The
walkers live in [`fjs/compiler/graph`](../../../compiler/graph/module.f.mjs); the page is
[`fjs/compiler/sugar/demo.f.mjs`](../../../compiler/sugar/demo.f.mjs), a
stage page named after the `sugar` pass it shows, beside the other stage
pages, because it runs the parser, and `fjs/js/ast`
importing from `fjs/compiler` is the upward import
[compiler-layer-upward-imports](../../../todo/compiler-layer-upward-imports.md)
removes.

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
does. It copies no stage logic. Each import record is passed to `normalize`
as the value it stands for, so every imported name is a FAST module parameter
of its own, as in the EDAG lowering before linking.

**A refusal is shown in the parser's own words**, in place of both panes.
`normalize` has no refusal of its own: it is total over what the parser
admits.

**Under each graph, a collapsed DataJS listing of the same tree**, so the
drawing can be checked against the exact structure.

#### Shapes

The two trees share their structure: `SourceOperator<V>` is `Operator<V>`
plus the logical binaries, and both sides have blocks, statements, exits,
loops and functions built the same way. The shapes follow that:

- one `Shape` function for the common part (`Operator<V>`, `Step<V>`,
  `Item<V>`, `Entry<V>`, `Key<V>`), generic over the operand. The [EDAG demo](../../../compiler/edag/demo.f.mjs) already
  draws these operators, chains included: the EDAG spells them with the same
  tuples except for the array and object tags (`'[]'`/`'{}'` there,
  `'array'`/`'object'` in FAST). So the shape is extracted from that demo,
  parameterized by the two tags, and the EDAG demo uses it too, rather than
  a second drawing of the same operators being written;
- a FAST walker and a source walker, each adding only its own forms.

All of them live in [`fjs/compiler/graph`](../../../compiler/graph/module.f.mjs),
beside [`fjs/compiler/stage_demo`](../../../compiler/stage_demo/module.f.mjs):
like it, they serve the compiler's stage pages and nothing else. They draw
with the website's renderer and read the parser's `ResolvedModule`, which
`fjs/js/ast`, below the compiler and the website, may not import.

What the drawing shows:

| Thing | Drawn as |
| ----- | -------- |
| block | a node with one row per statement and an `exit` row |
| binding (`BindingId`) | one node per identity, holding what defines it. The source pane labels it with its name from the parser's `origins`; FAST has no names, so the FAST pane numbers it `$n` in definition order ([fast-binding-origins](../sugar/todo/fast-binding-origins.md)) |
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

**A binding is drawn after its deepest use**, as every node is: the
renderer ranks by longest path, so every arrow points forward, and a
parameter's node lands right of the body that reads it, at the end of a
long arrow from its function. Placing a binding beside the row that
defines it was prototyped and rejected. The renderer can draw an arrow
pointing back only as the dotted lane it uses for recursion and exits, so
every use looked like recursion, and lanes into one node merge, so the
two reads of `x` in `x + x` looked like one.

### Tasks

- [x] The shared `Operator<V>` shape, extracted from the EDAG demo with its
      proofs, and the EDAG demo drawing through it unchanged.
- [x] The FAST walker, with its proof: shared bindings, lazy defines,
      captures, loops with their exits, `return` to an outer function.
- [x] The source walker, with its proof: the logical binaries, expansion
      plans, `initialize`/`write`, `while`, `switch`.
- [x] The demo page with both panes, the refusals and the DataJS listings;
      its proof walks the shared presets.
- [ ] Decide whether the parser demo keeps its DataJS listing or points here.

### Related

- [`fjs/edag/todo/graph-visualizer.md`](../../../edag/todo/graph-visualizer.md):
  the same drawing one stage later, for the EDAG.
- [`fjs/compiler/todo/output-demos.md`](../../../compiler/todo/output-demos.md):
  the stage pages this page joins.
- [`fjs/website/demo/README.md`](../../../website/demo/README.md): how a
  demo looks.
