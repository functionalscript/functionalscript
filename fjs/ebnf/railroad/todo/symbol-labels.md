## Label the symbols of any alphabet

**Priority:** P4
**Status:** open

### Problem

[`toDiagrams`](../module.f.mjs) labels a terminal's symbols as code points:
`a`, `space`, `U+00E9`. That is right for every grammar with a demo today —
JSON, DataJS, the JavaScript tokens and Markdown all read code points — and
wrong for the grammars that read something else:

- [`token_symbol/`](../../token_symbol/README.md) symbols start at `0x110000`,
  past the last code point. The FunctionalScript parser's grammar,
  [`fsc/parser/grammar`](../../../fsc/parser/grammar/module.f.mjs), is written
  over them, so its terminals are tokens — `id`, `=>`, `import` — that a
  code-point label would show as `U+110005`.
- [`byte/`](../../byte/README.md) symbols are bytes: `0xE9` is half of a UTF-8
  sequence there, not `é`.

A symbol above `0x10FFFF` is refused today rather than labelled as the code
point it is not. A byte grammar is not refused — its symbols are all below
`0x100` — and would be labelled as Latin-1, which is the silence
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
rules out; no byte grammar is drawn today.

### Proposal

`toDiagrams` takes the alphabet's labels as a parameter — a function from a
symbol to its text — beside the rule set, with the code-point labelling it
has now as the one the text grammars pass:

- a token alphabet labels a symbol by `decode` from its
  [`encoding`](../../token_symbol/module.f.mjs), so a terminal reads `=>` or
  `id`;
- a byte alphabet labels a byte as `0xE9` outside printable ASCII.

With it, `fsc/parser/grammar` can get the same demo as the grammars in
[`ebnf/lib`](../../lib/): it is the grammar a reader of the language most
wants to see.

### Open questions

- A range of token symbols has no meaning a reader could use (`id … =>`); a
  token set is better drawn as the choice of its tokens, however many runs
  it has.
- The parser grammar is large, 969 lines of front-end rules; which of its
  rules get titles decides whether its page reads as a specification.

Raised in review of
[#2358](https://github.com/functionalscript/functionalscript/pull/2358).
