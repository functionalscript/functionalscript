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

Remove `string` from the generic `DataRule` / `Rule` representation. Unicode
helpers should translate strings into ordinary generic rules before the grammar
reaches `fjs/bnf/data`, so `fjs/bnf/data/module.f.mjs` no longer imports
`stringToCodePointList` or performs a string-specific conversion.

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

- [`fjs/media/json/todo/bnf-grammar-single-owner.md`](../../media/json/todo/bnf-grammar-single-owner.md)
  is blocked by this task. Its implementation must import Unicode-specific
  construction from `fjs/bnf/unicode/module.f.mjs` and lower text literals to
  generic rules before they reach core BNF.
- [`fjs/bnf/todo/207.md`](./207.md) is blocked by this task. Its planned
  split/revision must remove `string` as a generic rule kind. Unicode text helpers
  are constructors of ordinary generic rules rather than a distinct generic rule
  kind.
- The `Repeat` rule kind has shipped and is **not** affected by this split. Its
  earlier design did use a bare `string` as a generic rule and `typeof rule ===
  'number'` terminal dispatch; the implemented one uses neither — a `Repeat` is
  `{ repeat: [name] }`, and `isRepeat` in `fjs/bnf/data/module.f.mjs` is the
  single discriminator to re-point when the rule model changes.
- [`fjs/bnf/todo/rule-visitor.md`](./rule-visitor.md) is blocked by this task and
  the bigint symbol/range migration. Its visitor must be defined against the
  final post-migration `Rule` union: it must not preserve a generic string branch
  or bake in `typeof rule === 'number'` as the terminal discriminator.
- [`fjs/bnf/todo/recognizer-backend.md`](./recognizer-backend.md) is blocked by
  this task. It previously assigned byte/hex/byte-range helper creation to the
  recognizer work; those helpers now belong exclusively to `fjs/bnf/byte`, and
  recognizer/DFA backends consume the generic rules produced by that adapter.
- [`fjs/bnf/todo/proof-recognizer-and-fixtures.md`](./proof-recognizer-and-fixtures.md)
  is blocked by this task. Its shared `number` fixture currently constructs text
  terminals with core `range('--')` / `range('09')` and assumes `testlib.f.mjs`
  obtains those helpers from `./module.f.mjs`; after the split, fixture construction
  must import the Unicode adapter while descent/LL1 remain generic consumers.
- [`fjs/bnf/todo/data-tosequence-reuse.md`](./data-tosequence-reuse.md) is
  **irrelevant because it is superseded by this task**. It proposed preserving
  `bnf/data`'s string case and reusing core `toSequence`; this task removes that
  string case and moves `toSequence` to the Unicode adapter instead, so there is
  no duplicate generic string-expansion implementation left to reuse.

Do not implement these older designs against the pre-split API. The irrelevant
`data-tosequence-reuse.md` should not be implemented at all; when the other TODOs
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
- [ ] Remove `string` as a generic BNF `DataRule` / `Rule` case.
- [ ] Remove Unicode string expansion from `fjs/bnf/data/module.f.mjs`.
- [ ] Make any core combinators that currently embed string/Unicode syntax
      alphabet-agnostic; keep optional Unicode conveniences in
      `fjs/bnf/unicode/module.f.mjs`.
- [ ] Update grammars and imports to construct text terminals through the Unicode
      helpers instead of relying on raw strings as generic rules.
- [ ] Keep EOF generic and width-independent: use core BNF's `EOF = -1`, and keep
      all alphabet adapters restricted to ordinary non-negative symbols without
      reserving the maximal value.
- [ ] Update/block `fjs/media/json/todo/bnf-grammar-single-owner.md` so its JSON
      grammar design imports Unicode helpers from `fjs/bnf/unicode/module.f.mjs`
      and does not depend on raw string rules in core BNF.
- [ ] Keep `fjs/bnf/todo/207.md` blocked until it is rebased/split so `string` is
      no longer described as a generic rule kind; Unicode text constructors lower
      to ordinary generic rules before semantic evaluation.
- [ ] Re-point `isRepeat` in `fjs/bnf/data/module.f.mjs` at the post-split rule
      model; the shipped `Repeat` encoding reuses neither bare `string` nor a
      `typeof rule === 'number'` terminal test, so nothing else about it moves.
- [ ] Keep `fjs/bnf/todo/rule-visitor.md` blocked until the final post-split and
      post-bigint `Rule` discriminants are settled; define its visitor against
      those semantic cases rather than the obsolete raw-string/number tests.
- [ ] Keep `fjs/bnf/todo/recognizer-backend.md` blocked on this split and have it
      consume byte helpers from `fjs/bnf/byte/module.f.mjs` rather than defining
      another binary-helper family.
- [ ] Keep `fjs/bnf/todo/proof-recognizer-and-fixtures.md` blocked on this split;
      rebase its shared text fixtures/testlib imports on
      `fjs/bnf/unicode/module.f.mjs` before implementing the extraction.
- [ ] Keep `fjs/bnf/todo/data-tosequence-reuse.md` irrelevant/superseded; do not
      implement its old generic-string reuse proposal.
- [ ] Add byte helper proofs for byte boundaries and representative binary
      sequences/ranges.
- [ ] Move/add proof coverage so generic BNF proofs exercise abstract symbols and
      Unicode proofs cover string/code-point conversion and boundaries.
- [ ] Document the boundary: `bnf` is generic; `bnf/unicode` and `bnf/byte` adapt
      concrete alphabets to generic BNF symbols.
- [ ] `npx tsc`, `fjs test`.

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
- [JSON BNF grammar owner](../../media/json/todo/bnf-grammar-single-owner.md) —
  blocked on this split and must target `bnf/unicode` for text terminals.
- [BNF semantic actions](./207.md) — blocked on this split; its rule model must
  remove generic `string` before implementation.
- [LL(1) repeat flattening](./ll1-repeat-flatten.md) — unaffected by this split;
  the shipped `Repeat` encoding never used a bare string.
- [BNF rule visitor](./rule-visitor.md) — blocked on the final generic `Rule`
  discriminants; its visitor must not encode the pre-migration string/number
  dispatch assumptions.
- [Recognizer backend](./recognizer-backend.md) — blocked on this split and must
  consume `bnf/byte` helpers instead of owning a duplicate binary authoring API.
- [Shared recognizer/proof fixtures](./proof-recognizer-and-fixtures.md) — blocked
  on this split; text fixture construction moves to `bnf/unicode` while parser
  backends stay alphabet-agnostic.
- [Reuse `toSequence` in BNF data](./data-tosequence-reuse.md) — irrelevant because
  it is superseded by this split; generic BNF data no longer performs Unicode
  string expansion.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — currently mixes generic and Unicode
  rule construction.
- [`fjs/bnf/data/module.f.mjs`](../data/module.f.mjs) — currently expands string
  rules into Unicode code-point terminals.
