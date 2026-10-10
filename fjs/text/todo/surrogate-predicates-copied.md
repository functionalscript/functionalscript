## Surrogate predicates are copied outside `fjs/text`

**Priority:** P4
**Status:** open

### Problem

[`fjs/text/code_point`](../code_point/module.f.mjs) exports
`isHighSurrogate` and `isLowSurrogate` over named bounds, and keeps a
private `isSurrogate` over the whole block. Callers answer the same
questions with constants of their own:

- [`fjs/effects/node`](../../effects/node/module.f.mjs) defines private
  `isHighSurrogate` and `isLowSurrogate` — the same names, over
  `0xd800..0xdbff` and `0xdc00..0xdfff` spelled out — for `_pieces`, which
  cuts a string into chunks on code-point boundaries.
- `loneSurrogate` in [`fjs/media/rust`](../../media/rust/module.f.mjs)
  tests the block by string comparison, `c >= '\ud800' && c <= '\udfff'`,
  because the combined predicate is not exported. Its `utf16Units` also
  re-derives [`fjs/text/utf16`](../utf16/module.f.mjs)'s `stringToList`
  with `charCodeAt` over an index range.

A Unicode constant written twice is a constant that drifts, and the rules
[non-integer-code-points](./non-integer-code-points.md) will settle for
`code_point`'s predicates will not reach the copies.

### Proposal

- `effects/node` imports the two predicates it copied.
- `code_point` exports `isSurrogate`; `media/rust` asks it of the code unit.
- `text/utf16` gains the two questions these callers actually ask — the
  last code-point boundary at or before an index, which `_pieces` needs,
  and whether a string holds a lone surrogate, which `stringLiteral` needs
  — so neither caller keeps surrogate arithmetic of its own.

### Tasks

- [ ] Export `isSurrogate`; add the two `utf16` helpers with proofs at 100%.
- [ ] Move `_pieces`, `loneSurrogate` and `utf16Units` onto them.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [190-text-code-unit-string-boundary](./190-text-code-unit-string-boundary.md)
  — inline `charCodeAt` and `fromCharCode` across the tree; `utf16Units` is
  one more.
