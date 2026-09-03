## Separate alphabet-specific BNF helpers

**Priority:** P3
**Status:** blocked
**Blocked by:**
- [grammar-bucket](../../todo/grammar-bucket.md) stage 1, which creates
  `fjs/grammar/terminal/` and moves `TerminalRange`, `rangeEncode` and
  `rangeDecode` into it. The adapters this issue creates are built on those,
  and their final paths (`fjs/grammar/unicode/`, `fjs/grammar/byte/`) only
  exist once the bucket does. This issue is that plan's stage 2.
- [ebnf-front-end](./ebnf-front-end.md)'s Problem 9 — one adapter must serve
  both front ends, which want different representations. It is a design
  answer, actionable now, but the adapter's public shape follows from it.

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
- `fjs/grammar/unicode/module.f.mjs` contains helpers for constructing generic
  BNF rules from Unicode code points and JavaScript strings.
- `fjs/grammar/byte/module.f.mjs` contains helpers for constructing generic BNF
  rules over binary byte streams, including the byte range `0..255` and
  convenient byte sequence/set/range construction where useful.

Those are **final** paths, not `fjs/bnf/unicode/` and `fjs/bnf/byte/` as this
issue first proposed. The adapters are siblings of the front ends rather than
parts of one — both the classical and the EBNF front end depend on them — so
they belong in the grammar bucket
([grammar-bucket](../../todo/grammar-bucket.md)). Creating them under
`fjs/bnf/` first would put a public API at an intermediate path and force a
second breaking move, which is what that plan's one-hop rule forbids. This
issue is its stage 2, and depends on stage 1 having extracted the neutral
codec into `fjs/grammar/terminal/`, which is where these adapters get
`rangeEncode` / `rangeDecode` and the `TerminalRange` type.

Move Unicode-specific APIs such as these to `fjs/grammar/unicode/module.f.mjs`:

- `unicodeRange`
- `unicodeMax`
- `toSequence`
- `str`
- `set`
- `range`
- `notSet`

The exact list should follow the semantic boundary: if an API needs to interpret
text as Unicode code points, it belongs in `fjs/grammar/unicode`. Likewise,
helpers that interpret binary data as byte symbols belong in
`fjs/grammar/byte` rather than core BNF.

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
symbols. A Unicode convenience wrapper may live in `fjs/grammar/unicode` if useful.

EOF is a generic symbol convention rather than an alphabet-specific helper, so
`fjs/grammar/terminal/` owns it — `EOF = -1`, outside the non-negative
physical-symbol domain — not the front end stage 1 moves it out of. Unicode,
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
  construction from `fjs/grammar/unicode/module.f.mjs` and lower text literals to
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
  after this split removes one; the terminal discriminant, by contrast, is the
  shipped `number` one, and centralizing it in the visitor is that task's
  point.
- [`fjs/bnf/todo/recognizer-backend.md`](./recognizer-backend.md) is blocked by
  this task. It previously assigned byte/hex/byte-range helper creation to the
  recognizer work; those helpers now belong exclusively to `fjs/grammar/byte`, and
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

- [ ] Add `fjs/grammar/unicode/module.f.mjs` for Unicode code-point rule
      helpers, at that final path — not under `fjs/bnf/`.
- [ ] Add `fjs/grammar/byte/module.f.mjs` for binary byte-stream rule helpers,
      likewise at its final path.
- [ ] Point `fjs/bnf/token_symbol` at `fjs/grammar/unicode` for `unicodeRange`,
      so it stops reading it from the front end
      ([grammar-bucket](../../todo/grammar-bucket.md) stage 2).
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
      `fjs/grammar/unicode/module.f.mjs`.
- [ ] Update grammars and imports to construct text terminals through the Unicode
      helpers instead of relying on raw strings as generic rules. `fjs/bnf/lib/json`
      and `fjs/bnf/lib/datajs` are importers of the removed core helpers and use
      raw strings throughout, so they are ported **in this change**: this is a
      breaking change, and [AGENTS.md §5](../../../AGENTS.md) requires every
      importer updated in the same PR. `tsc` enforces it regardless — the split
      cannot land green without them. Staging it (add
      `fjs/grammar/unicode`, port the importers, then remove the core exports)
      is the alternative, not deferral. `fjs/djs/parser` and `fjs/djs/tokenizer`
      are importers too — the parser takes `unicodeRange` from the same import
      line as its terminal and combinator exports — so they are ported here as
      well.
- [ ] Keep EOF generic and width-independent: use `fjs/grammar/terminal/`'s
      `EOF = -1` — stage 1 moves it out of the front end and adds no
      re-export — and keep all alphabet adapters restricted to ordinary
      non-negative symbols without reserving the maximal value.
- [ ] Restate the helper set and import boundary in
      [`bnf-grammar-single-owner`](./bnf-grammar-single-owner.md) against the
      names this split actually ships, rather than the proposed ones it is
      written on. That issue is blocked on this split for the design work the
      port does not settle — parameterizing `string`, which digit rules are
      exported, and sharing them with the `fsc` tokenizer — not for the port
      itself, which is the previous task's and lands here.
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
      consume byte helpers from `fjs/grammar/byte/module.f.mjs` rather than defining
      another binary-helper family.
- [ ] Keep `fjs/bnf/todo/proof-recognizer-and-fixtures.md` blocked on this split;
      rebase its shared text fixtures/testlib imports on
      `fjs/grammar/unicode/module.f.mjs` before implementing the extraction.
- [ ] Add byte helper proofs for byte boundaries and representative binary
      sequences/ranges.
- [ ] Move/add proof coverage so generic BNF proofs exercise abstract symbols and
      Unicode proofs cover string/code-point conversion and boundaries.
- [ ] Document the boundary: the core is generic; `fjs/grammar/unicode` and
      `fjs/grammar/byte` adapt
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
  consume `fjs/grammar/byte` helpers instead of owning a duplicate binary
  authoring API.
- [Shared recognizer/proof fixtures](./proof-recognizer-and-fixtures.md) — blocked
  on this split; text fixture construction moves to `fjs/grammar/unicode` while parser
  backends stay alphabet-agnostic.
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
  What is still open there is Problem 9 — how one adapter serves both front
  ends, which want different representations from `range` and `set` — and it
  decides this module's public shape, so answer it before building.
- [grammar-bucket](../../todo/grammar-bucket.md) — its stage 1 moves the
  alphabet-neutral codec out of the front end and leaves every
  text-interpreting helper to this issue. The adapter's final home there is
  `fjs/grammar/unicode/` (with `byte/` beside it), a bucket sibling: it
  outlives the classical front end, and this issue does not close when that
  front end is deleted.
