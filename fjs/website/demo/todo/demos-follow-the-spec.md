## Demos follow the presentation spec

**Priority:** P3
**Status:** wip

### Problem

[`../README.md`](../README.md) states the presentation rules. The lead,
caption and example-name migrations are complete, and the text, bit-group
and versions demos use the shared refusal element. The output-box migration remains:

- **Text results outside a code box.** [UTF-8](../../../text/utf8/demo.f.mjs)
  still draws its result as a bare `pre`, as does
  [BigInt](../../../types/bigint/demo.f.mjs) once `Measure` has run.
  The compiler's side-by-side, parser, serializer, Rust and tokenizer
  pages and JSON already use neutral `data-code` boxes. Their copy-button
  decisions remain: a result intended for pasting elsewhere uses
  [`codeBlock`](../code/module.f.mjs), while an inspection-only listing
  can keep a plain code box.

The browser test runner's failure block is a deliberate exception: it is
[`resultView`](../../../emergent_testing/browser/module.f.mjs), the same
bordered, tinted report row that every page's test section draws. Its demo
must show a report that looks like a real run.

### Proposal

The refusal migration is complete; VDF and PoW use the shared element
while verification verdicts keep their result presentation. Finish the
output boxes and decide per
output whether a copy button is useful. `codeMarker` and `resultMarker`
already connect the markup to the stylesheet, with proofs pinning their
literal names and the code block and refusal shapes.

The remaining two subtasks will land in separate pull requests from the
lead and caption migration. Check affected demos in the browser and put
their branch preview links in each description.

### Tasks

- [x] A lead option on `textDemo`; every `textDemo` demo through it.
- [x] Leads for SHA-2, Base64 and CBase32.
- [x] Finish the shared refusal migration for VDF and PoW.
- [x] Captions for the parser, serializer, Rust and tokenizer pages.
- [x] Rename DataJS's `Error: JSON is not a document`.
- [ ] Finish code boxes for UTF-8 and BigInt's measured rows; decide copy
      buttons for compiler outputs and JSON. The other listed text demos
      already have neutral code boxes.

### Related

- [`../README.md`](../README.md) — the spec this issue brings the demos to.
