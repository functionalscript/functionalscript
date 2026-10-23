## Stripes demo: the next steps

**Priority:** P4
**Status:** wip

### Problem

The demo ([`../demo.f.mjs`](../demo.f.mjs)) draws every level's words, up to
the root, and which hash-level symbols are hashes. How much each row holds,
what a symbol is, and how an edit changes the stripes, it does not show.

### Proposal

Each of these is its own step:

- **Examples.** A drop-down of named inputs, as the demo guide asks for a
  module with behaviours one input cannot show: the root as an L3 symbol,
  a raw root, hashes inside the rows, hashing up to the top, characters of
  several bytes, and no input at all. The demo opens on an overview that
  shows hashes, which `Hello` does not.
- **Sizes.** Each row's size: the bits its symbols hold, not their count
  times 256. L1 to L3 hold the input and padding exactly; a row loses bits
  only where its symbols are hashes.
- **Symbols.** A stripe's symbol and its word, and the bits it decodes back
  to, by clicking it.
- **An edit.** Change a byte and see which stripes stay the same, as the
  versions demos do for the Patricia trie and the B-tree.
- **An `Id`.** Paste one and see which of the three it is: an L3 literal,
  a raw bit vector and its bits, or a hash.
