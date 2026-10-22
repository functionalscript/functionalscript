## Stripes demo: the next steps

**Priority:** P4
**Status:** wip

### Problem

The demo ([`../demo.f.mjs`](../demo.f.mjs)) draws only the literal levels,
L1 to L3. What SUL does above them, and what a symbol is, it does not show.

### Proposal

Each of these is its own step, after the first one shipped:

- **Hash levels.** Rows above L3, up to the root, with the padding `end`
  adds, drawn from the encoder's own account of where words end —
  `pushWithHeight` and `endWithHeights` ([`../module.f.mjs`](../module.f.mjs))
  — rather than a copy of it. A stripe is still the run of input bits one
  symbol covers, but a stripe is coloured by its kind too: a raw `Id`, which
  holds those bits inline, or a hash, which does not — so a reader sees
  where hashing starts. The root is written out as its `Id`. Decided for
  this step: the rows scroll sideways on one line rather than wrap, with
  the rows' names kept in view; input is limited to 128 bytes, so hashing
  shows inside the rows and not only at the root; and the padding is drawn
  in full, faded, even where it is longer than the input.
- **Sizes.** Each row's size: the bits its symbols hold, not their count
  times 256. L1 to L3 hold the input and padding exactly; a row loses bits
  only where its symbols are hashes.
- **Symbols.** A stripe's symbol and its word, and the bits it decodes back
  to, by clicking it.
- **An edit.** Change a byte and see which stripes stay the same, as the
  versions demos do for the Patricia trie and the B-tree.
- **An `Id`.** Paste one and see which of the three it is: an L3 literal,
  a raw bit vector and its bits, or a hash.
