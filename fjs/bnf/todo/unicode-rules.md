## Separate alphabet-specific BNF helpers

**Priority:** P3
**Status:** open

### Problem

`fjs/bnf/module.f.mjs` currently mixes two different layers:

- generic BNF rule/range machinery over an abstract symbol alphabet;
- Unicode-specific conveniences that interpret JavaScript strings as sequences
  or sets of Unicode code points.

The generic BNF layer should not know that any particular symbol is a Unicode
code point. This becomes especially important when layered parsing uses the same
BNF machinery for different alphabets: bytes, Unicode code points, tokenizer
output symbols, and potentially other intermediate symbol streams.

The coupling is not limited to helper functions in `fjs/bnf/module.f.mjs`.
`DataRule` currently includes `string`, and `fjs/bnf/data/module.f.mjs` recognizes
that case and converts the string with `stringToCodePointList`. Therefore the
serializable/core BNF conversion path itself currently has Unicode semantics.

### Proposal

Split alphabet-specific rule construction from the generic BNF module:

- `fjs/bnf/module.f.mjs` defines generic symbols/ranges, rule types, and grammar
  combinators. It has no dependency on text/Unicode or byte-stream modules and
  does not give JavaScript `string` or byte-container values terminal meaning.
- `fjs/bnf/unicode/module.f.mjs` contains helpers for constructing generic BNF
  rules from Unicode code points and JavaScript strings.
- `fjs/bnf/byte/module.f.mjs` contains helpers for constructing generic BNF rules
  over binary byte streams, including the byte range `0..255` and convenient
  byte sequence/set/range construction where useful.

Move Unicode-specific APIs such as these to `fjs/bnf/unicode/module.f.mjs`:

- `unicodeRange`
- `unicodeMax`
- `toSequence`
- `str`
- `set`
- `range`
- `notSet`

The exact list should follow the semantic boundary: if an API needs to interpret
text as Unicode code points, it belongs in `fjs/bnf/unicode`. Likewise, helpers
that interpret binary data as byte symbols belong in `fjs/bnf/byte` rather than
core BNF.

Remove `string` from the *functional* `DataRule` / `Rule` representation in
`fjs/bnf/types.ts`. Unicode helpers should translate strings into ordinary
generic rules before the grammar reaches `fjs/bnf/data`, so
`fjs/bnf/data/module.f.mjs` no longer imports `stringToCodePointList` or performs
a string-specific conversion. This does not touch the *data* `Rule` in
`fjs/bnf/data/types.ts`, where a string is a `Repeat` and means the name of a
rule to repeat.

Keep generic combinators generic. If an existing combinator currently embeds
Unicode syntax in its API (for example `commaJoin0Plus` accepting `'[]'` and
constructing `','` as a string rule), change its core form to accept rules or
symbols. A Unicode convenience wrapper may live in `fjs/bnf/unicode` if useful.

EOF remains a generic BNF symbol convention rather than an alphabet-specific
helper. Core BNF defines `EOF = -1`, outside the
non-negative physical-symbol domain. Unicode, byte, token, and future alphabet
adapters therefore produce only ordinary non-negative symbols and never need to
reserve one value from their own alphabet. After the bigint migration the full
uint256 range `0 .. 2^256 - 1` remains available for ordinary symbols.

The result should allow the same core BNF API to describe grammars over any
symbol alphabet without importing or depending on Unicode or byte-stream support.

### Dependent design documents

This split changes the public design assumptions used by older open TODOs:

- [`fjs/bnf/todo/bnf-grammar-single-owner.md`](./bnf-grammar-single-owner.md)
  is blocked by this task. The grammars it now owns — `fjs/bnf/lib/json` and
  `fjs/bnf/lib/datajs` — must import Unicode-specific construction from
  `fjs/bnf/unicode/module.f.mjs` and lower text literals to generic rules before
  they reach core BNF. One literal there does not decompose: DataJS's
  `'["__proto__"]'` key is a single exact token that admits no whitespace and no
  escape substitutions.
- [`fjs/bnf/todo/207-bnf-semantic-actions.md`](./207-bnf-semantic-actions.md) is
  **no longer blocked** by this task. It has been rewritten over the *data*
  `RuleSet`, where the functional Unicode-literal string never arrives —
  `toData` has already expanded it to terminals — so it never names `string` as
  a generic rule kind. What this split changes for it is indirect and is **not**
  about names: a transformer map is keyed by the *rule value*, not by anything
  `toData` generates, so renaming nothing matters. What does matter is that
  lowering text literals through the Unicode adapter changes **which rule values
  a grammar has**, and an entry keyed on a rule the adapter replaced is an entry
  for a rule the grammar no longer contains — which 207's construction check
  rejects. Whoever ports a grammar re-points its entries at the adapter's rules,
  or takes them from a fragment the adapter supplies. That is the grammar's
  business (JSON's is tracked in
  [`bnf-grammar-single-owner`](./bnf-grammar-single-owner.md)),
  not the transformer protocol's.
- The `Repeat` rule kind has shipped, and this split **helps** it. A `Repeat` is
  a bare rule name, so `bnf/data`'s `Rule` now has a string case — but that is
  the *data* `Rule`, which never had the Unicode-literal string case this task
  removes from the *functional* `DataRule`. Removing the functional one leaves
  `string` with exactly one meaning per layer instead of two spellings that only
  ever met inside `data()`'s `case 'string'`. `isRepeat` in
  `fjs/bnf/data/module.f.mjs` is the single discriminator to re-point if the
  rule model moves again.
- [`fjs/bnf/todo/rule-visitor.md`](./rule-visitor.md) is blocked by this task
  alone, now that the bigint symbol/range migration is
  [on hold](./bigint-symbols.md). Its visitor must not preserve a generic string
  branch after this split removes one; the terminal discriminant, by contrast, is
  the shipped `number` one, and centralizing it in the visitor is that task's
  point.
- [`fjs/bnf/todo/recognizer-backend.md`](./recognizer-backend.md) is blocked by
  this task. It previously assigned byte/hex/byte-range helper creation to the
  recognizer work; those helpers now belong exclusively to `fjs/bnf/byte`, and
  recognizer/DFA backends consume the generic rules produced by that adapter.
- [`fjs/bnf/todo/proof-recognizer-and-fixtures.md`](./proof-recognizer-and-fixtures.md)
  is blocked by this task. Its shared `number` fixture currently constructs text
  terminals with core `range('--')` / `range('09')` and assumes `testlib.f.mjs`
  obtains those helpers from `./module.f.mjs`; after the split, fixture construction
  must import the Unicode adapter while descent/LL1 remain generic consumers.
- `data-tosequence-reuse` (retired; **superseded by this task**, and deleted
  with its reason recorded here) proposed preserving
  `bnf/data`'s string case and reusing core `toSequence`; this task removes that
  string case and moves `toSequence` to the Unicode adapter instead, so there is
  no duplicate generic string-expansion implementation left to reuse.

Do not implement these older designs against the pre-split API. The retired
`data-tosequence-reuse` proposal should not be implemented at all; when the other TODOs
are next revised/split, update their status/dependency headers and examples to the
new module boundary and final rule discriminants before implementation starts.

### Tasks

- [ ] Add `fjs/bnf/unicode/module.f.mjs` for Unicode code-point rule helpers.
- [ ] Add `fjs/bnf/byte/module.f.mjs` for binary byte-stream rule helpers.
- [ ] Move Unicode constants and string/code-point helper functions out of
      `fjs/bnf/module.f.mjs`.
- [ ] Remove Unicode/text imports from `fjs/bnf/module.f.mjs`.
- [ ] Keep byte-container interpretation out of `fjs/bnf/module.f.mjs` and
      `fjs/bnf/data/module.f.mjs`.
- [ ] Remove `string` as a functional BNF `DataRule` / `Rule` case; leave the
      data `Rule`'s string case, which is `Repeat`, alone.
- [ ] Remove Unicode string expansion from `fjs/bnf/data/module.f.mjs`.
- [ ] Make any core combinators that currently embed string/Unicode syntax
      alphabet-agnostic; keep optional Unicode conveniences in
      `fjs/bnf/unicode/module.f.mjs`.
- [ ] Update grammars and imports to construct text terminals through the Unicode
      helpers instead of relying on raw strings as generic rules.
- [ ] Keep EOF generic and width-independent: use core BNF's `EOF = -1`, and keep
      all alphabet adapters restricted to ordinary non-negative symbols without
      reserving the maximal value.
- [ ] Restate the helper set and import boundary in
      [`bnf-grammar-single-owner`](./bnf-grammar-single-owner.md) once this
      split's real API exists, so the port it describes is written against
      shipped names rather than proposed ones. The port itself is that issue's
      to make and is blocked on this one — not a box this task can tick.
- [ ] Re-point the rule **values** `fjs/bnf/todo/207-bnf-semantic-actions.md`
      keys its transformer maps on after this split: it is no longer blocked by
      it, but lowering text literals through the Unicode adapter replaces rule
      values, and an entry for a replaced rule is one the grammar no longer
      contains. Names are not involved — 207 keys by value.
- [ ] Check `isRepeat` in `fjs/bnf/data/module.f.mjs` still holds after the
      split: a data `Rule` that is a string is a `Repeat`, and removing the
      functional Unicode-literal case only makes that reading unambiguous.
- [ ] Keep `fjs/bnf/todo/rule-visitor.md` blocked until this split settles the
      `Rule` union; define its visitor against the resulting semantic cases
      rather than the obsolete raw-string test.
- [ ] Keep `fjs/bnf/todo/recognizer-backend.md` blocked on this split and have it
      consume byte helpers from `fjs/bnf/byte/module.f.mjs` rather than defining
      another binary-helper family.
- [ ] Keep `fjs/bnf/todo/proof-recognizer-and-fixtures.md` blocked on this split;
      rebase its shared text fixtures/testlib imports on
      `fjs/bnf/unicode/module.f.mjs` before implementing the extraction.
- [ ] Add byte helper proofs for byte boundaries and representative binary
      sequences/ranges.
- [ ] Move/add proof coverage so generic BNF proofs exercise abstract symbols and
      Unicode proofs cover string/code-point conversion and boundaries.
- [ ] Document the boundary: `bnf` is generic; `bnf/unicode` and `bnf/byte` adapt
      concrete alphabets to generic BNF symbols.
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/bnf/README.md`](../README.md#terminals-and-eof) — EOF is outside every
  physical alphabet, so adapters do not reserve a width-dependent value.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — after this split, the core
  symbol-domain migration can stay independent of alphabet semantics and retain
  the full uint256 ordinary-symbol range.
- [Layered parser](./layered-parser.md) — each parser layer can use the same BNF
  machinery with a different symbol alphabet.
- [UTF-8 token symbols](./utf8-token-symbols.md) — tokenizer-output symbols are
  another non-Unicode alphabet consumed by the generic BNF core.
- [JSON BNF grammar owner](./bnf-grammar-single-owner.md) —
  blocked on this split; the grammars it owns (`fjs/bnf/lib/json`,
  `fjs/bnf/lib/datajs`) must target `bnf/unicode` for text terminals.
- [BNF rule transformers](./207-bnf-semantic-actions.md) — not blocked on this
  split: it is defined over the data `RuleSet`, which never had the generic
  string case. Its maps are keyed by rule **value**, so this split changes which
  rule values its entries must name, not any spelling.
- [`../data/README.md`](../data/README.md#the-repeat-rule) — unaffected by this
  split; the shipped `Repeat` encoding is a data-layer string, not a functional
  one.
- [BNF rule visitor](./rule-visitor.md) — blocked on the final generic `Rule`
  discriminants; its visitor must not encode the pre-migration string/number
  dispatch assumptions.
- [Recognizer backend](./recognizer-backend.md) — blocked on this split and must
  consume `bnf/byte` helpers instead of owning a duplicate binary authoring API.
- [Shared recognizer/proof fixtures](./proof-recognizer-and-fixtures.md) — blocked
  on this split; text fixture construction moves to `bnf/unicode` while parser
  backends stay alphabet-agnostic.
- data-tosequence-reuse (retired; superseded by this split) — reusing core
  `toSequence` in `bnf/data`; generic BNF data no longer performs Unicode
  string expansion, so there is nothing left to reuse.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — currently mixes generic and Unicode
  rule construction.
- [`fjs/bnf/data/module.f.mjs`](../data/module.f.mjs) — currently expands string
  rules into Unicode code-point terminals.
