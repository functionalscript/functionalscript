## The query encoder spells the unreserved set a second time

**Priority:** P3
**Status:** open

### Problem

`escaped` in [`fjs/website/demo/sharing/module.f.mjs`](../module.f.mjs)
classifies bytes with bare numbers and spells the `%XX` escape itself:

```js
// escaped
b >= 0x61 && b <= 0x7a || b >= 0x41 && b <= 0x5a || b >= 0x30 && b <= 0x39
    || [0x2d, 0x2e, 0x5f, 0x7e].includes(b)
    ? String.fromCharCode(b)
    : `%${b.toString(16).padStart(2, '0').toUpperCase()}`
```

[`fjs/text/percent`](../../../../text/percent/module.f.mjs) already owns the
same classification and the same escape, built from `text/ascii`'s named
predicates and `basen/base16`: `isPathByte` over `pathMarks`, `hexByte`,
`pathByte`. The one difference is `/`: a path keeps it, a query component
escapes it. The sharing module imports `percentDecode` from `text/percent` for
the other direction, so its encoder is a second copy of a codec whose decoder
it already uses.

### Proposal

`text/percent` parameterises the mark set — `encodeWith(marks)` — and exports
`percentEncodeComponent` (the RFC 3986 unreserved set) beside
`percentEncodePath` (which keeps `solidus` and its escape-preserving rule).
`demo/sharing` imports it and `escaped` goes, together with the
`stringToU8List`/`toArray` imports only it needed. Its proof keeps the query
fixtures.

### Tasks

- [ ] Export `percentEncodeComponent` from `text/percent`, with its proof.
- [ ] Replace `escaped` with it.
