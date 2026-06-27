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

#### Not in scope: the `0xffffffff` out-of-range sentinel

`utf16ByteToCodePointOp` flags an out-of-range 16-bit unit with a literal
`0xffffffff` (`fs/text/utf16/module.f.ts:212-214`) while the other error branches
use `word | errorMask` / `state | errorMask`. An earlier draft of this issue
proposed "fixing" the literal to `errorMask`; that is **wrong** and is recorded
here so it isn't re-proposed:

- `0xffffffff` already has the error bit set (`0xffffffff & errorMask` is
  truthy), so mask-based consumers do recognize it as an error.
- The value is deliberately distinct from `word | errorMask`: the latter
  preserves the offending in-range word in the low bits, whereas a non-`u16`
  unit has no meaningful word to preserve, so the all-ones sentinel is used.
- `fs/text/utf16/proof.f.ts:19-20` asserts `toCodePointList([-1, 65536])` returns
  `[4294967295, 4294967295]` (`0xffffffff`). Replacing it with `errorMask`
  (`0x80000000`) would change the observable output and break that proof.

So leave `0xffffffff` as is; this issue is only about sharing the classification
predicates below.

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

The `0xffffffff` out-of-range sentinel stays as is (see "Not in scope" above).

### Tasks

- [ ] Add the BMP / surrogate / supplementary / validity predicates to
      `fs/text/code_point/module.f.ts`, built from one set of range constants;
      add `proof` coverage for each.
- [ ] Replace the utf8 `bigRange`/`smallRange`/`isValidCodePoint` definitions
      with imports from `code_point`.
- [ ] Replace the utf16 `lowBmp`/`highBmp`/`isBmpCodePoint`/surrogate/
      supplementary definitions with imports from `code_point`.
- [ ] Run `npx tsc` and `fjs t`; confirm utf8/utf16 proofs keep full coverage.

### Related

- `fs/text/code_point/module.f.ts` — already the shared home for `errorMask`
  and `decoder`; the predicates are the same kind of shared Unicode contract.
