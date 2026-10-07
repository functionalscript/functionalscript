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
  in. Only rtti uses the tinted `data-result="error"` box.
- **No caption over the output.** The parser, serializer, Rust and tokenizer
  pages show their result with nothing to say what it is.
- **A verdict in an example's name.** DataJS's
  `Error: JSON is not a document`.
- **A text result outside a code block.** The compiler's side-by-side page
  (all five outputs), parser, serializer, Rust and tokenizer pages, JSON and
  UTF-8 draw their result as a bare `pre`, not in the bordered `data-code`
  box the spec gives a text result. So does BigInt, once `Measure` has run:
  its benchmark rows.

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
  elsewhere. The four compiler pages build their result with one repeated
  `kind === 'ok' ? ['pre', value] : …` line, which the refusal element can
  replace together with it.

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
      rows; decide per demo whether the result carries a copy button.

### Related

- [`../README.md`](../README.md) — the spec this issue brings the demos to.
