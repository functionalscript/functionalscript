## edag-stage1-flat-examples. Re-notate the flat constructor examples

**Priority:** P4
**Status:** open

### Problem

[`edag-stage1-discussion.md`](./edag-stage1-discussion.md) states both
structural constructors in the nested form its normative parts now use —
`["[]", [...node]]` and `["{}", [...entry]]`, matching the schema in
[`fjs/edag/module.f.mjs`](../fjs/edag/module.f.mjs) and the form column in
[`fjs/edag/README.md`](../fjs/edag/README.md) — but roughly a dozen of its
worked examples still spell the operands flat, as `["[]", x, x]`. The empty
object appears throughout as the one-element `["{}"]`, which the schema
writes `["{}", []]`.

The normative places were corrected in
[#1756](https://github.com/functionalscript/functionalscript/pull/1756) after
review found the design and the schema disagreeing: the structural-operations
table, subject 4's resolution and history, the object-constructor validation
rule, and the three forms in
[`compile-modules-to-edag.md`](../fjs/djs/todo/compile-modules-to-edag.md).
The examples were left because they do not all want the same treatment, and
deciding per site is a judgement about what each passage is for — which is
this issue.

The risk is mild but real: someone reading a worked example rather than the
table copies a shape validation rejects. Nothing is wrong in the code, and
`fjs/edag/README.md` is correct throughout, which is why this is P4 rather
than the P2 the original finding carried.

### Proposal

Three classes, and only the first is mechanical.

**1. Re-notate — examples describing today's shape.** Rewrite these to the
nested form, including `["{}"]` → `["{}", []]`:

|Section|What it shows|
|-|-|
|Baseline: an expression DAG with anchored evaluation|`["[]", x, x]` vs `["[]", ["{}"], ["{}"]]`, and the `export default` code block below it|
|The core invariant|the same sharing pair; `["()", f, ["[]", a, b]]`|
|Other operations|the `["=>", ["[]", ["self"]], …]` and `["()", …, ["[]", …]]` frame examples|
|4. Object constructor: ordered entries|the integer-key ordering caveat, `["{}", [":", "2", a], [":", "1", b]]`|
|9. Canonical graph serialization and hashing|the sharing pair again|
|10. Free variables|`["()", ["self"], ["[]"]]`|
|12. `toString(f)`|the sharing pair again|

The sharing pair (`["[]", x, x]` against `["[]", ["{}"], ["{}"]]`) recurs in
four sections and should read identically in all four.

**2. Leave, or annotate — passages quoting a superseded proposal.** Rewriting
these falsifies the record rather than correcting it, because the flat
spelling is what the quoted proposal said:

- *4. Object constructor* — "*Rejected: forbidding descriptor-array identity
  reuse*" quotes an earlier draft's own `["{}", e, e]`.
- *6. Command vocabulary* — "the earlier objection — that `["[]", a, b]` would
  read as both a two-element array and `a[b]`". Worth a note rather than a
  rewrite: the nested form removes that ambiguity outright, which is an
  argument for it the section does not yet make.
- *6. Command vocabulary* — "**Decided: the object constructor is `"{}"` with
  ordered entries**" writes `["{}", [":", key, value], …]`. This one is a
  decision record that is *also* read as current, so it likely does want the
  nested form plus a note that only the operand grouping changed, not the
  decision.

**3. Leave alone — prose ellipses.** `["[]", ...]` and `["{}", …]` standing for
"the array node" in *The core invariant*, *Other operations*, *4. Object
constructor*, and *6. Command vocabulary* say nothing about operand grouping
and are not claims about shape.

Sections are named rather than line numbers cited, per
[tokenizer-line-citations](../fjs/js/todo/tokenizer-line-citations.md).

### Tasks

- [ ] Re-notate the class-1 examples, including every `["{}"]` → `["{}", []]`.
- [ ] Decide each of the three class-2 passages: leave, annotate, or rewrite.
- [ ] Re-read the document for flat forms this inventory missed — it was built
      by grepping `["[]"` and `["{}"`, which does not catch a constructor
      written across a line break.
- [ ] `npx tsc`, `fjs test` — documentation only, but the repo's gate.

### Related

- [`../fjs/edag/README.md`](../fjs/edag/README.md) — "Why an array operand
  rather than a variadic tail" gives the reason the shape is what it is.
- [`edag-stage1-discussion.md`](./edag-stage1-discussion.md) — the document
  this corrects.
- [`edag-spec.md`](./edag-spec.md) — where subjects are distilled once decided;
  it should not inherit the flat spelling.
