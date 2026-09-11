## Separate alphabet-specific helpers

**Priority:** P3
**Status:** blocked
**Blocked by:**
- [symbol-domain-owner](../../todo/symbol-domain-owner.md), the
  `fjs/ebnf/terminal/` module, which carries the terminal domain and the
  integer helpers over `fjs/types/range_set` values
  ([ebnf-range-set](../../terminal/todo/ebnf-range-set.md)). The adapter this
  issue creates is built on those. This issue is that plan's `unicode/`
  piece; the `byte/` piece it also carried shipped as
  [`../../byte`](../../byte/README.md).

### Problem

A grammar is written over an abstract symbol alphabet, and the same
machinery reads bytes, Unicode code points, token symbols and whatever
intermediate stream a layered parser produces. The front end,
[`../../module.f.mjs`](../../module.f.mjs), should not know that any
particular symbol is a Unicode code point beyond what its own rule union
says, and everything that reads text to build a rule should live in an
adapter for that alphabet.

The classical `fjs/bnf`, since deleted, mixed the two layers in one module
— generic rule machinery beside conveniences that interpreted JavaScript
strings as sets of code points, and a serializable form whose conversion
itself expanded strings — and this issue was filed against it. The EBNF
front end was built with the split in mind, and most of what the issue
asked for is settled there; what remains is the adapter itself.

### Proposal

- `fjs/ebnf/module.f.mjs` defines the symbols, the rule union and the
  combinators. A JavaScript `string` in the `Rule` union means one terminal
  per code point — the front end's own meaning, applied by the lowering in
  [`../../data`](../../data/README.md) — and `range`, `set` and `unicodeMax`
  ship there too (**Amended**, below).
- `fjs/ebnf/unicode/module.f.mjs` holds the text helpers the rule union does
  *not* imply, in EBNF forms: `str`, `not` and `unicodeRange`.
- `fjs/ebnf/byte/module.f.mjs` holds the helpers over a byte stream —
  shipped, with the byte range `0..255`, `bytes`, `not` and `ascii`.

**Amended.** The front end shipped with `range`, `set` and `unicodeMax` in
`fjs/ebnf/module.f.mjs`, which therefore imports `fjs/text/utf16`. What
settles it: **a `string` in the `Rule` union is a Unicode sequence** — one
terminal per code point ([`../../README.md`](../../README.md)). The front
end is Unicode-aware in its own rule union: every grammar written against
it spells terminals as JavaScript strings, and reading one as code points
is the front end's own meaning, not an adapter's interpretation of it. A
helper that reads a string to build a terminal set commits to nothing the
union has not already committed to, so moving `range` and `set` out would
put the same alphabet on two sides of a boundary rather than on one.

What that leaves for the adapter is what the union does *not* settle: an
alphabet whose symbols are not code points at all — `byte/` is that case,
and it is the consumer that made the boundary pay — and the text helpers
beyond a literal:

- `unicodeRange` — the Unicode universe as the range-set value
  `[0, 0x110000]`, which `not` below consumes, and which
  [`../../token_symbol`](../../token_symbol/README.md) would read its start
  from rather than spelling `0x110000` itself;
- `str` — an ordered `Tuple` of one-symbol terminals, one per code
  point, exactly as a bare `string` lowers;
- `not` — difference against the Unicode universe, returning a terminal
  rule as the front end's `set`, `range`, `union` and `remove` do
  ([ebnf-range-set](../../terminal/todo/ebnf-range-set.md), **Amended**).
  The `djs` tokenizer's grammar, [`../../lib/js`](../../lib/js/module.f.mjs),
  spells its complements today as `remove` over `range('\0' + unicodeMax)`,
  which is what `not` names.

The direction the split protects is untouched either way: `rangeEncode`,
`union`, `remove`, `repeat` and everything derived from them take symbols
and rules, never text. EOF is a generic symbol convention rather than an
alphabet-specific helper, so `fjs/ebnf/terminal/` owns it — `EOF = -1`,
outside the non-negative symbol domain — and an alphabet adapter produces
only ordinary non-negative symbols and never reserves one of its own
values for it.

Generic combinators are best kept generic, and they are: `join(s)(r)` takes
its separator as a rule, so the front end's own form embeds no syntax and
needs no wrapper; `cj` in `ebnf/lib/json` keeps the two-symbol string
spelling for a bracket pair, which is a grammar's convenience rather than a
combinator's.

### Tasks

Everything here is additive in `fjs/ebnf/`.

- [ ] Add `fjs/ebnf/unicode/module.f.mjs` with `unicodeRange`, `str` and
      `not`, and its proof: string/code-point conversion, an astral character
      as one terminal, the universe's boundaries, a complement's.
- [x] Add `fjs/ebnf/byte/module.f.mjs` for binary byte-stream rule helpers —
      shipped as [`../../byte`](../../byte/README.md), for
      [git-objects](../../../../todo/git-objects.md), with proofs of the
      alphabet's boundaries and every rule form over bytes.
- [ ] Have `fjs/ebnf/token_symbol` take `unicodeRange` from `fjs/ebnf/unicode`
      when it lands, so no `ebnf/` module reads text constants from a front
      end — a repoint of one constant after the adapter exists, which
      nothing waits on.
- [ ] Leave `range`, `set` and `unicodeMax` in `fjs/ebnf/module.f.mjs`
      (**Amended** above); keep byte-container interpretation out of the
      front end and out of `fjs/ebnf/data/module.f.mjs`.
- [ ] Keep EOF generic and width-independent: `fjs/ebnf/terminal/`'s
      `EOF = -1`, and every alphabet adapter restricted to ordinary
      non-negative symbols without reserving the maximal value.
- [ ] Have [recognizer-backend](../../todo/recognizer-backend.md) consume
      byte helpers from `fjs/ebnf/byte/module.f.mjs` rather than defining
      another binary-helper family — recorded there.
- [ ] Document the boundary: the core is generic; `fjs/ebnf/unicode` and
      `fjs/ebnf/byte` adapt concrete alphabets to generic grammar symbols.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../README.md`](../../README.md) — the front end, and why a `string`
  in its rule union is a Unicode sequence.
- [ebnf-range-set](../../terminal/todo/ebnf-range-set.md) — the range-set
  terminal the adapter's helpers return, and the alphabet-scoped `not`.
- [256-bit bigint symbols](../../terminal/todo/bigint-symbols.md) — after
  this split, the symbol-domain migration stays independent of alphabet
  semantics.
- [Layered parser](../../todo/layered-parser.md) — each parser layer uses
  the same machinery with a different symbol alphabet.
- [UTF-8 token symbols](../../token_symbol/todo/utf8-token-symbols.md) —
  tokenizer-output symbols are another non-Unicode alphabet.
- [Recognizer backend](../../todo/recognizer-backend.md) — consumes
  `fjs/ebnf/byte` helpers instead of owning a duplicate binary authoring API.
- [`../../byte`](../../byte/README.md) — the byte half of this issue,
  shipped.
- [`../../module.f.mjs`](../../module.f.mjs) — the shipped front end, which
  carries `range`, `set` and `unicodeMax` (**Amended** above).
- [symbol-domain-owner](../../todo/symbol-domain-owner.md) — the
  `ebnf/terminal/` module, which supplies the terminal domain and the
  integer helpers over `fjs/types/range_set`. The migration that planned
  both ([DESIGN.md §11](../../../../doc/DESIGN.md#11-build-the-replacement-beside-the-module-it-replaces))
  left to this issue the text-interpreting helpers the front end's rule
  union does not imply.
