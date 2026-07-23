## surrogate-pair-in-code-point. Move surrogate-pair arithmetic to `code_point`

**Priority:** P4
**Status:** open

### Problem

`fjs/text/code_point/module.f.ts` owns the surrogate/BMP boundary as named
constants and derives every classification predicate from them (`:50-54`):

```ts
const surrogateMin = 0xd800 as const
const lowSurrogateMin = 0xdc00 as const
const surrogateMax = 0xdfff as const
const bmpMax = 0xffff as const
const maxCodePoint = 0x10_ffff as const
```

with the stated intent that "the surrogate bounds and the maximum appear
exactly once". But the surrogate-pair *arithmetic* — the inverse of those
predicates — re-hardcodes the same numbers in `fjs/text/utf16/module.f.ts`:

Encode (`:90-93`):

```ts
const n = codePoint - 0x1_0000
const high = (n >> 10) + 0xd800
const low = (n & 0b0011_1111_1111) + 0xdc00
return [high, low]
```

Decode (`:200-202`):

```ts
const high = state - 0xd800
const low = word - 0xdc00
return [[(high << 10) + low + 0x10000], null]
```

So the surrogate layout is split across two modules with no compile-time
link: `code_point` names the bounds for classification while `utf16`
re-spells `0xd800`, `0xdc00`, `0x10000`, and the un-named 10-bit payload
shift/mask for the pair math. The `code_point` module is documented as the
shared Unicode contract; the pair encoding is a pure Unicode fact and
belongs beside `isHighSurrogate`/`isLowSurrogate`/`isSupplementaryPlane`.

### Proposal

Move the inverse pair into `code_point`, derived from the existing constants
(separation of concerns justifies the move even with utf16 as the single
consumer today):

```ts
// fjs/text/code_point/module.f.ts
const supplementaryBase = bmpMax + 1

/** Splits a supplementary-plane code point into a `[high, low]` surrogate pair. */
export const toSurrogatePair = (cp: number): readonly [number, number] => {
    const n = cp - supplementaryBase
    return [(n >> 10) + surrogateMin, (n & 0x3ff) + lowSurrogateMin]
}

/** Combines a high/low surrogate pair into its supplementary-plane code point. */
export const fromSurrogatePair = (high: number) => (low: number): number =>
    ((high - surrogateMin) << 10) + (low - lowSurrogateMin) + supplementaryBase
```

`codePointToUtf16` (`fjs/text/utf16/module.f.ts:87-96`) and
`utf16ByteToCodePointOp`'s low-surrogate branch (`:199-203`) then call these
instead of re-deriving the constants. Every surrogate number then appears in
exactly one module, and a future consumer (e.g. a WTF-8/CESU-8 codec or a JS
string escape encoder) gets the arithmetic for free.

### Tasks

- [ ] Add `toSurrogatePair`/`fromSurrogatePair` (and `supplementaryBase`) to
      `fjs/text/code_point/module.f.ts`; cover them in its proof.
- [ ] Rewrite the two utf16 sites through them.
- [ ] `npx tsc` clean; `fjs t` passes (code_point/utf16 proofs).

### Related

- `fjs/text/code_point/module.f.ts:50-54` — the constants and their
  "appear exactly once" intent.
- [666-utf16-encode-errormask](./666-utf16-encode-errormask.md) — touches
  only the invalid branch of `codePointToUtf16`; orthogonal.
- `fjs/text/utf8/todo/error-tag-layout-constants.md` — the analogous
  "name the layout once" cleanup for utf8's bit layout.
