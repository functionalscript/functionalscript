## The compiler stage demos repeat one skeleton

**Priority:** P4
**Status:** open

### Problem

The compiler's demo pages — [`compiler`](../demo.f.mjs),
[`tokenizer`](../tokenizer/demo.f.mjs), [`parser`](../parser/demo.f.mjs),
[`edag`](../edag/demo.f.mjs), [`serializer`](../serializer/demo.f.mjs) and
[`rust`](../rust/demo.f.mjs) — share the same page structure with a
different stage in the middle:

- Every one calls `textDemo` with `label: 'Source'`, `init:
  examples[0][1]` and `examples` from the shared
  [example list](../examples/module.f.js); only `intro` and `name` differ.
- `_astOf`, `_graphOf`, `_sourceOf` and `_rustOf` begin
  `const result = parse('')(text)` and map a parse error to its message
  before handing the AST to their stage. The `edag` page spells the same
  branch as an `{ ok, error }` record rather than a `Result`.
- `serializer` and `rust` render the same arm:
  `[caption(…), codeBlock(toText(value), 'Copy … module', render(value))]`
  against `[refusal(value)]`.

[DESIGN.md §4](../../../doc/DESIGN.md#4-reuse-dry-and-separation-of-concerns)'s
"follow the example" is the rule here: the skeleton — source in, stage, a
code block or a refusal out — should exist once, and each page supply only
its stage. Adding a stage page copies an existing page's skeleton.

### Proposal

Beside the example list, one helper fills the shared `textDemo`
configuration from `intro` and `name`; one `parsed(stage)` maps the
parser's error to its message and the AST to the stage; and one code-output
renderer takes a caption and a copy label. Each page is then its intro, its
stage and its view.

### Tasks

- [ ] Add the three helpers with a proof at 100%.
- [ ] Move the six pages onto them, with the `edag` page's `{ ok, error }`
      record becoming a `Result` like the others.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%; check the six pages in the
      browser.

### Related

- [output-demos](./output-demos.md) — the design of these pages; this issue
  is the skeleton they share.
