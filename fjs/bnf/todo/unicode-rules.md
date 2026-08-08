## Separate Unicode BNF helpers

**Priority:** P3
**Status:** open

### Problem

`fjs/bnf/module.f.ts` currently mixes two different layers:

- generic BNF rule/range machinery over an abstract symbol alphabet;
- Unicode-specific conveniences that interpret JavaScript strings as sequences
  or sets of Unicode code points.

The generic BNF layer should not know that any particular symbol is a Unicode
code point. This becomes especially important when layered parsing uses the same
BNF machinery for different alphabets: bytes, Unicode code points, tokenizer
output symbols, and potentially other intermediate symbol streams.

The coupling is not limited to helper functions in `fjs/bnf/module.f.ts`.
`DataRule` currently includes `string`, and `fjs/bnf/data/module.f.ts` recognizes
that case and converts the string with `stringToCodePointList`. Therefore the
serializable/core BNF conversion path itself currently has Unicode semantics.

### Proposal

Split Unicode-specific rule construction from the generic BNF module:

- `fjs/bnf/module.f.ts` defines generic symbols/ranges, rule types, and grammar
  combinators. It has no dependency on text/Unicode modules and does not give
  JavaScript `string` values any terminal-symbol meaning.
- `fjs/bnf/unicode.f.ts` contains helpers for constructing generic BNF rules from
  Unicode code points and JavaScript strings.

Move Unicode-specific APIs such as these to `unicode.f.ts`:

- `unicodeRange`
- `unicodeMax`
- `toSequence`
- `str`
- `set`
- `range`
- `notSet`

The exact list should follow the semantic boundary: if an API needs to interpret
text as Unicode code points, it belongs in `unicode.f.ts`.

Remove `string` from the generic `DataRule` / `Rule` representation. Unicode
helpers should translate strings into ordinary generic rules before the grammar
reaches `fjs/bnf/data`, so `fjs/bnf/data/module.f.ts` no longer imports
`stringToCodePointList` or performs a string-specific conversion.

Keep generic combinators generic. If an existing combinator currently embeds
Unicode syntax in its API (for example `commaJoin0Plus` accepting `'[]'` and
constructing `','` as a string rule), change its core form to accept rules or
symbols. A Unicode convenience wrapper may live in `unicode.f.ts` if useful.

The result should allow the same core BNF API to describe grammars over any
symbol alphabet without importing or depending on Unicode support.

### Tasks

- [ ] Add `fjs/bnf/unicode.f.ts` for Unicode code-point rule helpers.
- [ ] Move Unicode constants and string/code-point helper functions out of
      `fjs/bnf/module.f.ts`.
- [ ] Remove Unicode/text imports from `fjs/bnf/module.f.ts`.
- [ ] Remove `string` as a generic BNF `DataRule` / `Rule` case.
- [ ] Remove Unicode string expansion from `fjs/bnf/data/module.f.ts`.
- [ ] Make any core combinators that currently embed string/Unicode syntax
      alphabet-agnostic; keep optional Unicode conveniences in `unicode.f.ts`.
- [ ] Update grammars and imports to construct text terminals through the Unicode
      helpers instead of relying on raw strings as generic rules.
- [ ] Move/add proof coverage so the generic BNF proofs exercise abstract symbols
      and the Unicode proofs cover string/code-point conversion and boundaries.
- [ ] Document the boundary: `bnf` is generic; `bnf/unicode` adapts Unicode text
      to generic BNF symbols.
- [ ] `npx tsc`, `fjs test`.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — after this split, the core
  symbol-domain migration can stay independent of Unicode semantics.
- [Layered parser](./layered-parser.md) — each parser layer can use the same BNF
  machinery with a different symbol alphabet.
- [UTF-8 token symbols](./utf8-token-symbols.md) — tokenizer-output symbols are
  another non-Unicode alphabet consumed by the generic BNF core.
- [`fjs/bnf/module.f.ts`](../module.f.ts) — currently mixes generic and Unicode
  rule construction.
- [`fjs/bnf/data/module.f.ts`](../data/module.f.ts) — currently expands string
  rules into Unicode code-point terminals.
