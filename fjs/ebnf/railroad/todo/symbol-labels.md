## Label the symbols of any alphabet

**Priority:** P4
**Status:** wip

### Problem

[`toDiagrams`](../module.f.mjs) labelled a terminal's symbols as code points
only: `a`, `space`, `U+00E9`. That is right for every grammar with a demo today —
JSON, DataJS, the JavaScript tokens and Markdown all read code points — and
wrong for the grammars that read something else:

- [`token_symbol/`](../../token_symbol/README.md) symbols start at `0x110000`,
  past the last code point. The FunctionalScript parser's grammar,
  [`compiler/parser/grammar`](../../../compiler/parser/grammar/module.f.mjs), is written
  over them, so its terminals are tokens — `id`, `=>`, `import` — that a
  code-point label would show as `U+110005`.
- [`byte/`](../../byte/README.md) symbols are bytes: `0xE9` is half of a UTF-8
  sequence there, not `é`.

A symbol above `0x10FFFF` is refused by the code-point alphabet rather than
labelled as the code point it is not. A byte grammar is not refused — its
symbols are all below `0x100` — and would be labelled as Latin-1, which is the
silence [DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
rules out; no byte grammar is drawn today.

### Design

`toDiagrams` takes an `Alphabet` ([`../types.ts`](../types.ts)) before the rule
set: how a set of symbols is labelled, and which symbols join into one literal.

- `codePoints` is the labelling the text grammars had: symbols and ranges, and
  a run of printable ASCII drawn as the one string it spells.
- `tokens(encoding, categories)` labels a symbol by `decode` from its
  [`encoding`](../../token_symbol/module.f.mjs), so a terminal reads `=>` or
  `import`. A range of tokens means nothing a reader could use (`id … =>`),
  so a token set is the choice of its tokens, however many runs it has, and
  tokens never join into one literal. A name in `categories` — `id`, `string`
  — stands for any token of its kind, not for its own text, and is drawn as a
  `category`: a grey pill with its name in italics, so only text the input
  holds is drawn in the terminal's blue.

### Tasks

- [x] `toDiagrams` takes an `Alphabet`; `codePoints` and `tokens`; the
  `category` piece in `website/demo/railroad`.
- [ ] A railroad demo of `compiler/parser/grammar`: it is the grammar a reader
  of the language most wants to see. Which of its rules get titles decides
  whether its page reads as a specification — the module's own `@module`
  EBNF names the candidates; `identifier` needs a title so its twelve
  branches are drawn once, and `eagerTail` so its generated layers are.
- [ ] A byte alphabet, labelling a byte as `0xE9` outside printable ASCII,
  before any byte grammar (`git/*`) is drawn.

Raised in review of
[#2358](https://github.com/functionalscript/functionalscript/pull/2358).
