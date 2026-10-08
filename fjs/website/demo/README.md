# How a demo looks

[`../README.md`](../README.md#a-demo-shows-what-a-module-does) says what a
demo *is*: a pure `init`/`update`/`view`, discovered by its `demo` export,
whose output a reader can check from outside. This file says how one *looks*,
so that a reader who has used one demo can read the next without learning a
new page.

The rules here were drawn from the demos already on the site, and where they
disagreed, one way was picked and the reason written down. So some demos do
not follow every rule yet; this file states the rules, and
[`todo/demos-follow-the-spec.md`](./todo/demos-follow-the-spec.md) lists the
demos that do not. A demo may
deviate where its subject needs it, and says why in its JSDoc.

## One order, top to bottom

```text
Demo                      ← the page's own heading; the demo never writes it
  lead                    ← what this is, how to read it, how to check it
  examples                ← optional drop-down of named inputs
  input                   ← labelled field(s); a button only for slow work
  output                  ← caption, then the result — or the refusal
```

**The demo never writes its own `h2`.** The page wraps every demo in a
section headed `Demo` (`demoSection` in [`../page/module.f.mjs`](../page/module.f.mjs)).
Inside it, a demo made of several parallel parts heads each with an `h3`:
several results side by side, as the compiler's side-by-side page and a
grammar's railroad diagrams show, or the halves of one workflow, as the VDF
demo's `Evaluate` and `Verify` are. It uses no other heading level.

## The lead: say what the reader is looking at

**Every demo opens with a lead: one to three sentences in a `p`, before any
control.** The page shows only the demo's view; the module's `@module` JSDoc
is not on it. Without a lead, a reader meets a textarea and a block of output
with nothing to say what either is for — which is how the bigint demo
explains writing its own (`fjs/types/bigint/demo.f.mjs`).

The lead says, in this order and as briefly as it can:

1. **What the module does to the input** — "Parses the text as JSON and
   writes it back with its keys sorted, on one line."
2. **How to read the output**, when it has a notation — the railroad
   diagrams' "a pill is text the input holds, and a box is another diagram".
3. **How to check it from outside**, when there is a way. A check that lives
   only in JSDoc is a check no reader of the page sees. Where the check is a
   command, the demo shows it under the result with the reader's input
   already in it, as a copyable block — the SHA-2 demo's "Verify
   independently with OpenSSL:" — rather than in the lead.

The lead is plain prose, not a caption: no trailing colon, no bold.

## Input

- **Every field has a visible `label`** naming what to type, as a noun in
  sentence case and without a colon: `Source`, `JSON`, `Text`,
  `A release file`. Where a label would break a sentence the field sits in,
  as the bigint demo's exponent does, the field carries `aria-label`
  instead.
- **The control fits what the reader types.** Text that can span lines — a
  program, a document, a release file — is a textarea, and a demo that is
  text in, text out uses [`textDemo`](./module.f.mjs), which owns the
  textarea, the examples drop-down and their wiring. One short value — a
  message to hash, a key, a number — is a single-line `<input
  type="text">`, as the SHA-2, bigint and versions demos use. A choice from
  a fixed set is a `<select>`, as SHA-2's algorithm is.
- **Every field has a unique `name`.** The runtime finds a field by its
  `name` to keep the reader's focus and the field's size across a render, a
  textarea, an input and a select alike, so two fields sharing one would
  lose them.
- **Typing updates the output at once.** A button is for an action typing
  must not trigger on its own: starting slow work (`Measure`,
  `Run the example`), committing a change, so a half-typed value never
  becomes one (the versions demos' `Insert` and `Remove`), or a tool such as
  the copy button on a [code block](#output). Its text is a verb that says
  what it does.

## The initial state shows the point

**The input the page opens on demonstrates what the demo exists for**, so
the reader sees it before changing anything. Where one input can show every
property, it does: the JSON demo opens on keys out of order and
pretty-printed, so both are visibly undone; the UTF-8 demo opens on one
character of each byte length. Where it cannot — properties that need inputs
of their own, such as a refused input beside an accepted one — the demo
offers [examples](#examples), and the one it opens on is an overview: the
central property the lead names, with as many of the others as one input
holds. The DataJS and EDAG demos name that first example `Overview`. An
empty initial input is right only when empty is itself the point.

## Examples

**Offer an examples drop-down when the module has several behaviours one
input cannot show** — the compiler's language features, DataJS's kinds of
sharing. Use [`examples`](./examples/module.f.mjs), through
`textDemo`'s `examples` option where the state is a text.

- The first example is the initial state.
- An example's name says what the input is (`Equal is not shared`,
  `Diamond`, `An import`), never `Example 1`, and never what a demo does
  with it. The verdict is the output's to show, in the
  [refusal](#refusals) box where there is one: one input can be accepted by
  one demo and refused by another — the parser takes an import the Rust
  page cannot link — and a name carrying a verdict would be wrong on one of
  them. [`compiler/examples`](../../compiler/examples/module.f.js) makes the
  same call for the same reason.

## Output

- **A caption names each result before it**: a `p` ending in a colon, saying
  what the result is and, where it matters, its notation — `SHA-256, hex:`,
  `Code points, UTF-8 hex:`, `Parsed, then written back:`. A demo whose only
  output is self-evident from the lead may omit it.
- **A text result is a code block**: a `pre` in an element marked
  `data-code`, the bordered, neutral box the SHA-2 demo draws its digest in.
  A result a reader will paste somewhere else — a digest, a command to run —
  is marked `data-code-block` too and carries a copy button, as both of the
  SHA-2 demo's blocks do (`codeBlock` in
  [`crypto/sha2/demo.f.mjs`](../../crypto/sha2/demo.f.mjs)).
- **A tint is a verdict, and only a verdict.** Where the demo's point is
  whether a reader *accepts* the input, the box is marked
  `data-result="ok"` (green) or `data-result="error"` (red) instead, as the
  rtti demo's parse and validate answers are (`answerView` in
  [`rtti/demo.f.mjs`](../../rtti/demo.f.mjs)). A result that is simply what
  the module computed — a digest, an AST, a generated module — stays
  neutral: green there would claim a check nobody made.
- How each marker looks is the stylesheet's, with its reasons, in
  [`../style/module.f.mjs`](../style/module.f.mjs); this file names the
  markers, not the colours.
- **Values are written the way the reader's own tool prints them**, so they
  can be compared character for character: lower-case hex padded to its full
  width, bytes separated by spaces.
- **An empty result is said in words**, never an empty box: `(empty)`, or a
  sentence where one reads better (`The trie is empty.`).

## Refusals

**When the module refuses the input, the demo shows the module's message in
place of the output, in a `pre` marked `data-result="error"`**: the box a
result sits in, tinted red, so the verdict reads before the message does. A
refusal is always a verdict, so it is always tinted, whether the demo's
results are.
The caption says it in words as well, because a colour alone is not a
verdict: `Refused:` where the result's caption would be. Where a demo shows
several readers' answers side by side, each caption carries its verdict, as
the rtti demo's `parse · ok` and `validate · error` do.

- **`Refused`, not `Error`.** The module did what it is designed to do with
  input it cannot handle
  ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)),
  and the word says so. *Error* is kept for a defect: the runtime reports a
  throw from `update` or `view` itself, apart from the demo.
- **The message is the module's own**, unedited, so what the page says is
  what the API answers.
- **A failure that belongs to one item of a valid result stays on that
  item's line**, as the UTF-8 demo marks one unpaired surrogate among valid
  code points: the result as a whole was not refused.

## What a demo's proof covers

Besides the 100% coverage every module owes, a demo's proof drives its view
for the initial state, for each example, and — where the module can refuse
an input — for one refused input, so a change that breaks any of them is
caught where it is made rather than on the page. A module that answers every
input has no refusal to drive: the tokenizer reads text it cannot tokenize
as an `error` token among the others, a line of its output, not a refusal.
