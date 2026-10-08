## Demos follow the presentation spec

**Priority:** P3
**Status:** open

### Problem

[`../README.md`](../README.md) says how a demo looks, and its rules were drawn
from the demos on the site; where those demos disagreed, one way was picked.
So some demos do not follow every rule yet. The spec states the rules; this
issue is where the demos that do not follow them are listed, so that the spec
never has to describe today's page and a list of exceptions inside it never
goes stale.

As measured on the tree the spec landed against:

- **No lead.** The compiler's side-by-side page, parser, serializer, Rust,
  tokenizer and EDAG pages, DataJS, JSON, Markdown, UTF-8 and the changelog
  use [`textDemo`](../module.f.mjs) and open on their fields without a lead.
  SHA-2, Base64 and CBase32 open on their fields too. A demo can add a lead
  by wrapping `textDemo`'s view, as [SHA-1](../../../crypto/sha1/demo.f.mjs)
  does; a shared lead option would avoid repeating that wrapper.
- **A refusal in the old shape.** The compiler's side-by-side, parser,
  serializer and Rust pages write `Refused:` and the message in one untinted
  paragraph. EDAG, DataJS, JSON, Markdown, the changelog and the
  [versions](../versions/module.f.mjs) helper (B-tree, Patricia trie) write
  `Error:` the same way, and JSON prints it inside the box its result sits
  in. Only rtti and PoW use the tinted `data-result="error"` box.
- **No caption over the output.** The parser, serializer, Rust and tokenizer
  pages show their result with nothing to say what it is.
- **A verdict in an example's name.** DataJS's
  `Error: JSON is not a document`.

Found later: the first by reading every `pre` the non-proof sources build,
states only a click reaches included, and the second in the VDF demo, which
landed after the list above was taken:

- **A text result outside a code block.** The compiler's side-by-side page
  (every output in [`outputs`](../../../compiler/demo.f.mjs)), parser,
  serializer, Rust and tokenizer pages, JSON and UTF-8 draw their result as
  a bare `pre`, not in the bordered `data-code` box the spec gives a text
  result. So does BigInt, once `Measure` has run: its benchmark rows.
  The browser test runner's failure block, drawn once its example has run,
  is a deliberate exception and stays as it is: it is the suite report's own
  row, [`resultView`](../../../emergent_testing/browser/module.f.mjs), which
  every page's test section draws too, so the demo cannot show a report that
  looks unlike a real run. That row is already a bordered box, tinted as the
  failure it reports.
- **A refusal as a tinted paragraph.** [VDF](../../../crypto/vdf/demo.f.mjs)
  refuses each input it cannot take — steps that are not a number, an input
  past the length limit, a claimed `y` that is too long, not hex or not below
  the modulus — with its message in a `p` marked `data-result="error"`: no
  `pre`, and no `Refused:` caption to say the verdict in words.

### Proposal

Change the shared builders first, so most demos move by changing one place:

- a required lead option on `textDemo` and on
  [`bitGroupDemo`](../bits/module.f.mjs), as
  [`versionsDemo`](../versions/module.f.mjs) and
  [`railroadDemo`](../railroad/module.f.mjs) already take an `intro`;
- one shared refusal element, `Refused:` over a `data-result="error"` box,
  whose proof pins the marker name — today a renamed marker leaves the spec
  wrong with every check green;
- a text result through the shared [`codeBlock`](../code/module.f.mjs), or a
  plain `data-code` box where the reader has no reason to paste it
  elsewhere, with a proof that pins the `data-code` marker as the refusal
  element's pins its own. Today `codeBlock`'s own proof does not pin it: only
  the demos whose proofs happen to quote the box do, such as VDF's and
  rtti's, so a demo whose proof does not can lose its box with every check
  green. The compiler's side-by-side, parser, serializer and Rust pages build
  their result with one repeated `kind === 'ok' ? ['pre', value] : …` line,
  which the refusal element can replace together with it.

Then the remaining demos, a few per pull request, each checked in the
browser with its preview link in the description.

### Tasks

- [ ] A lead option on `textDemo`; every `textDemo` demo through it.
- [ ] Leads for SHA-2, Base64 and CBase32.
- [ ] A shared refusal element with a proof; every demo above through it.
- [ ] Captions for the parser, serializer, Rust and tokenizer pages.
- [ ] Rename DataJS's `Error: JSON is not a document`.
- [ ] Text results in a code block for the compiler's side-by-side, parser,
      serializer, Rust and tokenizer pages, JSON, UTF-8 and BigInt's measured
      rows, with a proof pinning `data-code`; decide per demo whether the
      result carries a copy button.

### Related

- [`../README.md`](../README.md) — the spec this issue brings the demos to.
