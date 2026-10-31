## `codePoints` is a well-formed-string reader that belongs in `text/utf16`

**Priority:** P4
**Status:** open

### Problem

[`module.f.mjs`](../module.f.mjs), the grammar IR and lowering, exports a text
conversion:

```js
// codePoints
const list = toArray(stringToCodePointList(s))
assert(list.every(c => (c & errorMask) === 0), ['malformed UTF-16', s])
return list
```

Its three imports `errorMask`, `stringToCodePointList` and `toArray` exist in
this file for that function only. The front end — `range`, `set` and
`literals` in [`fjs/ebnf`](../../module.f.mjs) — and `ascii` in
[`fjs/ebnf/byte`](../../byte/module.f.mjs) import it *from the lowering*: the
front end reaches into its own back end for a string helper.

[`fjs/text/utf16`](../../../text/utf16/module.f.mjs) owns the same question in
two halves, `stringToCodePointList` and `isWellFormed`, and its README says
`isWellFormed` "is the question to ask before handing a string to something
that needs valid Unicode". Meanwhile
[`fjs/text/ascii`](../../../text/ascii/module.f.js) exports a third
`codePoints` with a weaker contract (a lone surrogate comes back unflagged),
and [`fjs/ebnf/railroad`](../../railroad/module.f.mjs) an unrelated
`codePoints` (its `Alphabet`): four modules export the name for three meanings.

### Proposal

One owner in `text/utf16`: `codePoints`, the well-formed code points of a
string, refused where `isWellFormed` is false, documented beside it. The EBNF
front end, `byte` and `data` import it from there; the `data` proof's
`codePoints` cases, the lone-surrogate throw included, move with it. Then
decide whether `text/ascii`'s `codePoints` keeps its name: its callers pass
ASCII, so the strict reader serves them.

### Tasks

- [ ] Move `codePoints` and its proof to `text/utf16`; update the three
      importers and the `data` README row that describes it.
- [ ] Decide the fate of `text/ascii`'s `codePoints`.

### Related

- [190-text-code-unit-string-boundary](../../../text/todo/190-text-code-unit-string-boundary.md)
  — the single-character readers; the same boundary, one level down.
