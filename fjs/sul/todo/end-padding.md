## Shorter padding at the end of a stream

**Priority:** P4
**Status:** open

### Problem

`encode`'s `end` (`fjs/sul/module.f.mjs`) closes a stream by pushing a `1`,
then `0`s, until a symbol reaches a hash level that did not exist yet. Every
extra level it needs costs L3 symbols made of padding alone, so the padding
grows with the number of levels rather than staying a word's worth. At
`94c92f8`, `"Hello, world! SUL"` — 136 bits — took 91 padding bits, and 11 of
its 19 L3 symbols held nothing but padding.

Padding is part of the root: the 136 bits above end up in a raw `Id` of 227
bits, close to the 253 bits a raw `Id` holds, so a few more input bytes turn
the root into a hash because of padding, not input.

### Proposal

None yet. Find out whether `end` can close the levels with less padding while
staying a bijection — every input still decodes to itself, and no two inputs
share a root.

### Related

- [`../demo.f.mjs`](../demo.f.mjs) — draws the padding the literal levels
  need, which stops at L3
