# Code point

## Shared code-point predicates

The code-point classification predicates — `isBmpCodePoint`, `isHighSurrogate`,
`isLowSurrogate`, `isSupplementaryPlane`, and `isValidCodePoint` — describe fixed
Unicode ranges, not per-encoding details, so they live in
[`module.f.ts`](./module.f.ts) alongside `errorMask` and `decoder`. They are
derived from one set of boundary constants so the surrogate bounds
(`0xD800`–`0xDFFF`) and the maximum code point (`0x10FFFF`) are spelled out
exactly once. UTF-8 and UTF-16 import them instead of redefining their own range
checks.

`isTextCodePoint` lives here too, but answers a different question: not whether a
code point is *well-formed* (`isValidCodePoint`) but whether it is *text*. A code
point is text unless it is a control character — C0 (`U+0000`–`U+001F`), `U+007F`
(DEL), and C1 (`U+0080`–`U+009F`) — minus the whitespace block `U+0009`–`U+000D`
(TAB, LF, VT, FF, CR), which is legitimate in text. The two are deliberately
distinct: a control byte such as NUL is perfectly valid UTF-8 yet not text, which
is exactly what `fs/mime` needs to split text from binary. `isValidCodePoint`
gates decoding (`fromVec`); `isTextCodePoint` gates classification.

`isValidCodePoint` was previously exported from `utf8/module.f.ts`; it now lives
solely on `code_point`. Importers — `fs/mime` and `utf8`'s own `fromVec` — take
it from `code_point` directly. This was a deliberate breaking change rather than
a re-export, on the principle that the predicate's canonical home is the shared
Unicode contract.
