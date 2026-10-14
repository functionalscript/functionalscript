## Surrogate predicates are copied outside `fjs/text`

**Priority:** P4
**Status:** wip

### Problem

[`fjs/text/code_point`](../code_point/module.f.mjs) exports
`isHighSurrogate` and `isLowSurrogate` over named bounds, and keeps a
private `isSurrogate` over the whole block. Other modules answer the same
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

A Unicode constant written more than once is a constant that drifts, and the rules
[non-integer-code-points](./non-integer-code-points.md) will settle for
`code_point`'s predicates will not reach the copies.

### Proposal

`text/utf16` owns the boundary logic. It gains the two questions these
callers actually ask — the last code-point boundary at or before an
index, which `_pieces` needs, and whether a string holds a lone
surrogate, which `stringLiteral` needs — built on `code_point`'s
predicates inside `text`. The callers ask those questions and nothing
lower: `effects/node` drops its predicate copies and imports no predicate
in their place, `media/rust` drops `loneSurrogate`, and `utf16Units`
reads numeric code units with `stringToList`, then formats each with its
existing `u16Hex`. `types/list`'s `map` and `toArray` keep the result an
ordered `readonly string[]` of Rust hex literals, not a numeric FJS list.
`utf16Literal` and the EDAG printer keep their Rust slice spelling; the
printer still marks each unit as a number.
No surrogate arithmetic remains outside `text`, and `code_point`'s
private `isSurrogate` stays private.

### Tasks

- [ ] The two `utf16` helpers with proofs at 100%.
- [ ] Move `_pieces` and `loneSurrogate` onto the new helpers, with
      the copied predicates deleted rather than imported.
- [ ] Rewrite `utf16Units` over `stringToList`, mapping `u16Hex` and
      materializing with `toArray`; keep its `(v: string) => readonly string[]`
      API and formatted unit order. Prove empty, BMP, surrogate-pair and
      lone-surrogate strings, preserving `utf16Literal`'s Rust slices and
      the EDAG printer's spelling and number marks.
- [ ] `tsc`, `fjs test`, `npm run cov` at 100%.

### Related

- [190-text-code-unit-string-boundary](./190-text-code-unit-string-boundary.md)
  — inline `charCodeAt` and `fromCharCode` across the tree; `utf16Units` is
  one more.
