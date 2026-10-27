## The top of Unicode has one owner

**Priority:** P4
**Status:** open

### Problem

[`fjs/text/code_point`](../code_point/module.f.mjs) keeps `maxCodePoint`
private, with a comment saying why: "`isSupplementaryPlane` already expresses
the one range a caller has wanted it for". The module's own rationale is that
"the surrogate bounds and the maximum appear exactly once". Neither is true
any more. At `c162c3a` the value is re-spelled by four consumers:

- [`fjs/ebnf`](../../ebnf/module.f.mjs)'s `unicodeMax`,
  `codePointListToString([0x10_FFFF])`;
- [`fjs/ebnf/railroad`](../../ebnf/railroad/module.f.mjs)'s `symbolText`,
  `assert(c <= 0x10_FFFF, …)`;
- [`fjs/ebnf/token_symbol`](../../ebnf/token_symbol/module.f.js)'s `start`,
  `0x11_0000`, documented as "one past the last Unicode scalar value";
- [`fjs/js/tokenizer`](../../js/tokenizer/module.f.mjs)'s `\u{…}` decoder,
  `state.acc <= 0x10_ffff` three times.

### Proposal

Export `maxCodePoint` as `bmpMax` already is, rewrite the comment, and derive
the four: `unicodeMax` from `codePointToString(maxCodePoint)`, the railroad
assertion and the tokenizer's bound from it, `token_symbol.start` as
`maxCodePoint + 1`.

### Tasks

- [ ] Export; proof line.
- [ ] The four consumers over it.

### Related

- [unicode-rules](../../ebnf/unicode/todo/unicode-rules.md) — keeps
  `unicodeMax` in `fjs/ebnf`; deriving it is compatible.
- [non-integer-code-points](./non-integer-code-points.md) — the integer
  domain of the same values.
