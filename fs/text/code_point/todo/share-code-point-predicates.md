## Share Unicode code-point predicates in `code_point`

**Priority:** P3
**Status:** open

### Problem

`fs/text/code_point/module.f.ts` is already the shared home for the cross-codec
Unicode contract: it owns `errorMask` and the streaming `decoder` factory that
both UTF-8 and UTF-16 build on. But the *code-point classification predicates* —
the BMP / surrogate / supplementary-plane / overall-validity ranges — are still
defined independently in each codec, even though they describe the same fixed
Unicode ranges.

`fs/text/utf8/module.f.ts:254-258`:

```ts
const bigRange = contains([0, 0x10FFFF])
const smallRange = contains([0xD800, 0xDFFF])
export const isValidCodePoint = (c: number) => bigRange(c) && !smallRange(c)
```

`fs/text/utf16/module.f.ts:48-76`:

```ts
const lowBmp = contains([0x0000, 0xd7ff])
const highBmp = contains([0xe000, 0xffff])
const isBmpCodePoint = (codePoint: CodePoint) => lowBmp(codePoint) || highBmp(codePoint)
const isHighSurrogate = contains([0xd800, 0xdbff])
const isLowSurrogate = contains([0xdc00, 0xdfff])
const isSupplementaryPlane = contains([0x01_0000, 0x10_ffff])
```

These are two encodings of one shared concern. The surrogate range
(`0xD800–0xDFFF`) and the maximum code point (`0x10FFFF`) are spelled out in
both modules; utf8's `isValidCodePoint` (valid range minus surrogates) is exactly
"in `bigRange`, not a surrogate", and the surrogate halves utf16 needs are the
two halves of utf8's `smallRange`. Code-point classification is a Unicode
concern, not a per-encoding concern — it belongs next to `errorMask` and
`decoder`, the other shared Unicode contracts.

#### Secondary: utf16 uses a stray error sentinel

In the same file, `utf16ByteToCodePointOp` flags an out-of-range 16-bit unit with
a literal `0xffffffff` instead of the shared `errorMask`
(`fs/text/utf16/module.f.ts:212-214`):

```ts
if (!u16(word)) {
    return [[0xffffffff], state]
}
```

Every other error branch in the same function uses `errorMask`
(`word | errorMask`, `state | errorMask`). `errorMask` is
`0b1000_0000_…_0000` (`0x80000000`), which is **not** `0xffffffff`, so this one
branch tags malformed units with a different value than the rest of the decoder.
Downstream consumers that test `result & errorMask` to detect errors will not
recognize this path. This is a small consistency/correctness fix that should ride
along with the predicate move.

### Proposal

Move the code-point classification predicates into
`fs/text/code_point/module.f.ts` as the single source of truth, and have utf8 and
utf16 import them:

- `isBmpCodePoint`, `isHighSurrogate`, `isLowSurrogate`, `isSupplementaryPlane`
  (currently utf16-private),
- `isValidCodePoint` (currently utf8-exported),

derived from one set of range constants so the surrogate bounds and `0x10FFFF`
appear exactly once. utf8's `bigRange`/`smallRange` and utf16's
`lowBmp`/`highBmp`/surrogate predicates then become imports.

Separately, replace the `0xffffffff` literal at
`fs/text/utf16/module.f.ts:214` with `errorMask` so all of utf16's error paths
emit the same tag as utf8.

### Tasks

- [ ] Add the BMP / surrogate / supplementary / validity predicates to
      `fs/text/code_point/module.f.ts`, built from one set of range constants;
      add `proof` coverage for each.
- [ ] Replace the utf8 `bigRange`/`smallRange`/`isValidCodePoint` definitions
      with imports from `code_point`.
- [ ] Replace the utf16 `lowBmp`/`highBmp`/`isBmpCodePoint`/surrogate/
      supplementary definitions with imports from `code_point`.
- [ ] Replace `0xffffffff` at `fs/text/utf16/module.f.ts:214` with `errorMask`.
- [ ] Run `npx tsc` and `fjs t`; confirm utf8/utf16 proofs keep full coverage.

### Related

- `fs/text/code_point/module.f.ts` — already the shared home for `errorMask`
  and `decoder`; the predicates are the same kind of shared Unicode contract.
