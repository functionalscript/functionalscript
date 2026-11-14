## Two `codePoints` with different contracts

**Priority:** P4
**Status:** open

### Problem

[`fjs/text/utf16`](../../utf16/module.f.js) owns `codePoints`, the code
points of a well-formed string, with a lone surrogate refused. This module
exports a second `codePoints`, `[...s].map(one)`, with a weaker contract: a
lone surrogate comes back unflagged, as its own code unit. Its callers — the
digit readers' inputs in `git/config`, the `crypto` demos, `website`, and
proofs in `compiler`, `zlib/adler32` and `nanvm/demos` — pass ASCII, which
the strict reader serves as well. [`fjs/ebnf/railroad`](../../../ebnf/railroad/module.f.mjs)
exports an unrelated `codePoints` (its `Alphabet`), so three modules export
the name for three meanings.

### Proposal

Decide whether this `codePoints` keeps its name: either its callers import
`text/utf16`'s, and this one goes, or it is renamed for what it reads.

### Tasks

- [ ] Decide the fate of `text/ascii`'s `codePoints`, and apply it to every
      importer.

### Related

- [190-text-code-unit-string-boundary](../../todo/190-text-code-unit-string-boundary.md)
  — the single-character readers; the same boundary, one level down.
