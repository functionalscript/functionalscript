## proof-recognizer-and-fixtures. The remaining whole-input checks and the JSON corpus

**Priority:** P4
**Status:** open

### Done

[`../testlib.f.mjs`](../testlib.f.mjs) holds `recognizer(parse, decode)` — an
adapter over an [`../ll1`](../ll1/README.md) parser that answers whether a text
is accepted with every symbol consumed, resuming a match that ends short and
carrying the last `MatchResult` as the diagnostic — and
`assertRecognizes(recognize)(cases)`, which fails with `[input, diagnostic]`.
The adapter takes a built `Parser` and the input decoding, not a `RuleSet` and
an entry name, because its consumers hold front-end rules and read different
alphabets (code points, code units). Its users are
`fjs/js/tokenizer/proof.f.mjs`'s `isValid` corpus, a one-token grammar resumed
per token, and `fjs/ebnf/lib/markdown/proof.f.mjs`'s `accepts` / `refuses`, a
grammar ending in `eof`; `fjs/ebnf/proof.f.mjs` proves the adapter's branches.

### Remaining

- [`../ll1/proof.f.mjs`](../ll1/proof.f.mjs) still spells "consumed all"
  itself — the `dataJs` and large-document cases compare a match's end with
  the text's length, and the integer lexer resumes a one-token parser in its
  own loop. It was left alone while another change was editing that proof;
  its cases pin trees and ends exactly, so convert only the rows that ask
  the whole-input question alone.
- `fjs/compiler/parser/grammar/proof.f.mjs`'s `read` reports where a module
  is refused by token name rather than accepted-or-not; it fits `Case` /
  `assertRecognizes` only with its own token-alphabet adapter and a diagnostic
  the corpus states, which is a separate decision.
- The JSON-shaped rows of the tokenizer's `isValid` (several JSON-rejecting
  texts accepted, since tokenization leaves structure to the parser) have no
  second consumer, so no shared corpus or override table exists. Make the
  divergence an explicit override list once a second consumer of the corpus
  appears.
