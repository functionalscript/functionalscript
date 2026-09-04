## Separate alphabet-specific BNF helpers

**Priority:** P3
**Status:** blocked
**Blocked by:**
- [ebnf-migration](../../todo/ebnf-migration.md)'s `fjs/ebnf/terminal/`,
  which carries the terminal domain and the integer helpers over
  `fjs/types/range_set` values ([ebnf-range-set](./ebnf-range-set.md)). The
  adapters this issue creates are built on those, and their final paths
  (`fjs/ebnf/unicode/`, `fjs/ebnf/byte/`) only exist once `fjs/ebnf/` does.
  This issue is that plan's `unicode/` piece.

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

Split alphabet-specific rule construction from the generic grammar module —
in `fjs/ebnf/`, where the split is built in from the start. `fjs/bnf/` is
not changed by this issue: it keeps its text helpers and its `string` rule
case until it is deleted, and the grammars written against it keep using
them ([ebnf-migration](../../todo/ebnf-migration.md), principle 4).

- `fjs/ebnf/module.f.mjs` defines generic symbols, rule types and grammar
  combinators. It has no dependency on text/Unicode or byte-stream modules.
  A JavaScript `string` in the EBNF `Rule` union means one terminal per code
  point — [ebnf-front-end](./ebnf-front-end.md) settles that — and the
  lowering in `fjs/ebnf/data/` is where that meaning is applied; every
  *other* text interpretation lives in the adapter.
- `fjs/ebnf/unicode/module.f.mjs` contains helpers for constructing generic
  BNF rules from Unicode code points and JavaScript strings.
- `fjs/ebnf/byte/module.f.mjs` contains helpers for constructing generic BNF
  rules over binary byte streams, including the byte range `0..255` and
  convenient byte sequence/set/range construction where useful.

Those are **final** paths, not `fjs/bnf/unicode/` and `fjs/bnf/byte/` as this
issue first proposed. The adapters are dependencies of the EBNF front end
rather than parts of it, and they serve that front end only, in its
representation ([ebnf-migration](../../todo/ebnf-migration.md)). Creating
them under `fjs/bnf/` would break that plan's dependency direction — `ebnf`
never imports `bnf` — the moment `fjs/ebnf/` used them. This issue is its
`unicode/` piece, and depends on `fjs/ebnf/terminal/`, which is where these
adapters get the terminal domain
and the integer helpers — `range`, `one`, `eof`, `toRangeMap` — over
`fjs/types/range_set` values ([ebnf-range-set](./ebnf-range-set.md)). There
is no packed codec and no `TerminalRange` in `fjs/ebnf/`. The classical front
end keeps its own text helpers until it is deleted.

Unicode-specific APIs such as these — today's `fjs/bnf/module.f.mjs`
exports, re-spelled in EBNF forms — go to `fjs/ebnf/unicode/module.f.mjs`:

- `unicodeRange`
- `unicodeMax`
- `toSequence`
- `str`
- `set`
- `range`
- `not` — difference against the Unicode universe `[0, 0x110000]`, in place
  of today's `notSet`

`set`, `range` and `not` return range-set *values*, combined with the
`range_set` algebra and made into a rule by `oneOf` in
`fjs/ebnf/module.f.mjs`; `str` and `toSequence` return rules, one terminal per
code point ([ebnf-range-set](./ebnf-range-set.md)).

The exact list should follow the semantic boundary: if an API needs to interpret
text as Unicode code points, it belongs in `fjs/ebnf/unicode`. Likewise,
helpers that interpret binary data as byte symbols belong in
`fjs/ebnf/byte` rather than core BNF.

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
symbols. A Unicode convenience wrapper may live in `fjs/ebnf/unicode` if useful.

EOF is a generic symbol convention rather than an alphabet-specific helper, so
`fjs/ebnf/terminal/` owns it — `EOF = -1`, outside the non-negative
physical-symbol domain — not the front end it is copied out of. Unicode,
byte, token, and future alphabet adapters therefore produce only ordinary
non-negative symbols and never need to reserve one value from their own
alphabet. After the bigint migration the full uint256 range `0 .. 2^256 - 1`
remains available for ordinary symbols.

The result should allow the same core BNF API to describe grammars over any
symbol alphabet without importing or depending on Unicode or byte-stream support.

### Dependent design documents

This split changes the public design assumptions used by older open TODOs:

- [`fjs/bnf/todo/bnf-grammar-single-owner.md`](./bnf-grammar-single-owner.md)
  owns the two grammars this task ports — `fjs/bnf/lib/json` and
  `fjs/bnf/lib/datajs` — and its "Unicode migration requirements" section is
  written for whoever makes that port. They must import Unicode-specific
  construction from `fjs/ebnf/unicode/module.f.mjs` and lower text literals to
  generic rules before they reach core BNF. DataJS's `'["__proto__"]'` key needs care: `str` lowers
  it to a contiguous sequence of terminal ranges, which is what it must become —
  the parser consumes code points, so a single terminal could not match it. It
  is one *token* because nothing separates that sequence's elements, not because
  it is one rule; keep it that way, with no `ws` between elements and no escape
  substitution inside.
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
  business, not the transformer protocol's — and for the two `fjs/bnf/lib`
  grammars it happens here, in the same change that ports them.
- The `Repeat` rule kind has shipped, and this split **helps** it. A `Repeat` is
  a bare rule name, so `bnf/data`'s `Rule` now has a string case — but that is
  the *data* `Rule`, which never had the Unicode-literal string case this task
  removes from the *functional* `DataRule`. Removing the functional one leaves
  `string` with exactly one meaning per layer instead of two spellings that only
  ever met inside `data()`'s `case 'string'`. `isRepeat` in
  `fjs/bnf/data/module.f.mjs` is the single discriminator to re-point if the
  rule model moves again.
- [`fjs/bnf/todo/rule-visitor.md`](./rule-visitor.md) is blocked by this task
  and by [ebnf-front-end](./ebnf-front-end.md)'s Problem 1; the bigint
  symbol/range migration is [on hold](./bigint-symbols.md) and no longer one
  of its blockers. Its visitor must not preserve a generic string branch
  after this split removes one; the terminal discriminant follows the
  range-set carrier ([ebnf-range-set](./ebnf-range-set.md)), and
  centralizing it in the visitor is that task's point.
- [`fjs/bnf/todo/recognizer-backend.md`](./recognizer-backend.md) is blocked by
  this task. It previously assigned byte/hex/byte-range helper creation to the
  recognizer work; those helpers now belong exclusively to `fjs/ebnf/byte`, and
  recognizer/DFA backends consume the generic rules produced by that adapter.
- [`fjs/bnf/todo/proof-recognizer-and-fixtures.md`](./proof-recognizer-and-fixtures.md)
  is **not** blocked by this task. Its shared `number` fixture is a directly
  authored `RuleSet` that imports no text helper — neither this adapter's,
  whose values are range sets the classical backends do not consume
  ([ebnf-range-set](./ebnf-range-set.md)), nor the classical one's.
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

Everything here is additive in `fjs/ebnf/`. No task removes anything from
`fjs/bnf/`: the classical helpers, the classical `string` rule case and the
grammars that use them stay until `bnf/` is deleted, and the two
`fjs/bnf/lib` grammars and the `fjs/djs` grammars adopt this adapter when
they are ported ([ebnf-migration](../../todo/ebnf-migration.md)'s consumer
port), not here.

- [ ] Add `fjs/ebnf/unicode/module.f.mjs` for Unicode code-point rule
      helpers, at that final path — not under `fjs/bnf/`.
- [ ] Add `fjs/ebnf/byte/module.f.mjs` for binary byte-stream rule helpers,
      likewise at its final path.
- [ ] Have `fjs/ebnf/token_symbol` take `unicodeRange` from `fjs/ebnf/unicode`
      when it lands, so no `ebnf/` module reads text constants from a front
      end.
- [ ] Keep `fjs/ebnf/module.f.mjs` free of Unicode/text imports, and keep
      byte-container interpretation out of it and out of
      `fjs/ebnf/data/module.f.mjs`; the one text meaning those two carry is
      the `string` case ebnf-front-end fixes.
- [ ] Keep EOF generic and width-independent: use `fjs/ebnf/terminal/`'s
      `EOF = -1` and keep all alphabet adapters restricted to ordinary
      non-negative symbols without reserving the maximal value.
- [ ] Restate the helper set and import boundary in
      [`bnf-grammar-single-owner`](./bnf-grammar-single-owner.md) against the
      names this adapter actually ships, rather than the proposed ones it is
      written on. That issue is blocked on this one for the design work the
      port does not settle — parameterizing `string`, which digit rules are
      exported, and sharing them with the `fsc` tokenizer.
- [ ] When a grammar is ported onto this adapter, re-point
      the rule **values** its `207-bnf-semantic-actions` transformer maps are
      keyed on: lowering text literals through the adapter replaces rule
      values, and an entry for a replaced rule is one the grammar no longer
      contains. Names are not involved — 207 keys by value.
- [ ] Have `fjs/bnf/todo/recognizer-backend.md` consume byte helpers from
      `fjs/ebnf/byte/module.f.mjs` rather than defining another binary-helper
      family.
- [ ] Leave `fjs/bnf/todo/proof-recognizer-and-fixtures.md`'s shared fixture
      as the directly authored `RuleSet` it specifies: it imports no text
      helper, neither this adapter's nor the classical one's.
- [ ] Add byte helper proofs for byte boundaries and representative binary
      sequences/ranges; Unicode proofs cover string/code-point conversion and
      boundaries; the generic `fjs/ebnf/` proofs exercise abstract symbols.
- [ ] Document the boundary: the core is generic; `fjs/ebnf/unicode` and
      `fjs/ebnf/byte` adapt concrete alphabets to generic grammar symbols.
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
- [JSON BNF grammar owner](./bnf-grammar-single-owner.md) — owns
  `fjs/bnf/lib/json` and `fjs/bnf/lib/datajs`, and records what their port must
  preserve. This split makes that port, since it is what breaks them; that issue
  is blocked on this one for the shared-lexical-API work that follows.
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
  consume `fjs/ebnf/byte` helpers instead of owning a duplicate binary
  authoring API.
- [Shared recognizer/proof fixtures](./proof-recognizer-and-fixtures.md) — not
  blocked on this split; its neutral fixture is a directly authored `RuleSet`
  and imports no text helper, so the parser backends stay alphabet-agnostic
  without it.
- data-tosequence-reuse (retired; superseded by this split) — reusing core
  `toSequence` in `bnf/data`; generic BNF data no longer performs Unicode
  string expansion, so there is nothing left to reuse.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — currently mixes generic and Unicode
  rule construction.
- [`fjs/bnf/data/module.f.mjs`](../data/module.f.mjs) — currently expands string
  rules into Unicode code-point terminals.
- [ebnf-front-end](./ebnf-front-end.md) — the second front end. It **keeps**
  `string` in its rule union, meaning one terminal per code point, the same as
  a bare string means today; that is settled there. So the "remove `string`
  from the functional `Rule`" task below is the classical front end's alone.
  Its Problem 9 — how one adapter serves both front ends — is dissolved by
  ebnf-migration: this adapter serves the EBNF front end only and returns its
  representation.
- [ebnf-migration](../../todo/ebnf-migration.md) — its `ebnf/terminal/`
  piece supplies the terminal domain and the integer helpers over
  `fjs/types/range_set` ([ebnf-range-set](./ebnf-range-set.md)) and leaves
  every text-interpreting helper to this issue, its `unicode/` piece. The
  adapter's final home is `fjs/ebnf/unicode/` (with `byte/` beside it), and
  this issue moves to `fjs/ebnf/unicode/todo/` with it.
