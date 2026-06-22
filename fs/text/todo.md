# 190. `fs/text`: own the single code-unit/code-point ↔ string boundary

**Priority:** P3
**Status:** open

Converting between a single character-code number and a one-character JS `string`
is a `fs/text` concern, but four modules reach into the `String` built-in
directly and three of them re-bind the same function under a local name:

```ts
// fs/html/module.f.ts:16
const { fromCharCode } = String

// fs/fsc/module.f.ts:19
const fromCharCode = String.fromCharCode

// fs/js/tokenizer/module.f.ts:73
const { fromCharCode } = String

// fs/text/utf16/module.f.ts:401  — used inline
export const listToString: (input: List<U16>) => string
    = fn(map(String.fromCharCode)) /* … */

// fs/bnf/module.f.ts:71
const { fromCodePoint } = String
```

And the inverse — index a string for a code unit / code point — is likewise
split:

```ts
// fs/text/ascii/module.f.ts:10
const r = s.codePointAt(i)
if (r === void 0) { throw s }

// fs/text/utf16/module.f.ts:359
const first = s.charCodeAt(i)
return isNaN(first) ? empty : { first, tail: () => at(i + 1) }
```

`fs/text/utf16` already owns the *list*-level boundary (`stringToList`,
`stringToCodePointList`, `listToString`, `codePointListToString`). What is missing
is the *single-character* primitive, so every tokenizer/serializer re-binds
`String.fromCharCode`/`fromCodePoint` itself. `AGENTS.md` explicitly discourages
reaching into built-ins from `.f.ts` modules and asks that conceptually-distinct
logic live in its natural module.

## Proposed abstraction

Expose single-character converters from the `fs/text` layer (next to the existing
list converters), e.g.:

```ts
// fs/text (or fs/text/utf16)
export const charFromCode:   (code: U16)       => string   // String.fromCharCode
export const charFromCodePoint: (cp: CodePoint) => string  // String.fromCodePoint
```

Then `html`, `fsc`, `js/tokenizer`, and `bnf` import these instead of re-binding
`String.*`, and `utf16.listToString` builds on `charFromCode`. The two string
*readers* (`ascii`'s throwing `codePointAt` and `utf16`'s lazy `charCodeAt`
stream) can likewise be named in `fs/text` so the JS-string boundary lives in one
namespace.

## Why this qualifies

- The plain `fromCharCode` re-binding has three consumers (`html`, `fsc`,
  `js/tokenizer`) plus the inline `utf16` use — the same "re-bound under a local
  name in module after module" smell that [i167](./README.md) flags for
  `bit_vec.listToVec(msb)`.
- Separation of concerns: code ↔ string conversion is the defining job of
  `fs/text`; scanners and serializers should consume it, not re-import `String`.

## Caveats

- These are thin wrappers over a built-in, so the value is *centralizing the
  boundary and removing scattered `String` references*, not algorithmic reuse —
  weigh that against the project's "don't add a layer no one needs" rule. The
  three-plus consumers and the existing `fs/text` boundary make the case.
- The two *readers* genuinely differ (one indexes by code point and throws for a
  constant-string lookup; the other streams code units lazily and ends on
  `NaN`). They share a concept, not an algorithm, so frame the reader half as
  separation-of-concerns, not a single parameterized factory.
- Keep `fs/text` free of cyclic deps: `ascii`, `bnf`, `fsc`, `js/tokenizer`, and
  `html` already sit above the text layer, so importing downward is clean.

## Related

- [i167](./README.md) — re-binding a shared helper under per-module names.
- [i168](./README.md) — the utf8/utf16 *decoder* skeleton (a different, list-level
  duplication; this issue is the single-character boundary).

---

# 666-utf16-encode-errormask. `codePointToUtf16` discards the error tag instead of preserving it

**Priority:** P5
**Status:** open

## Problem

`fs/text/code_point/module.f.ts` defines a *shared* contract for the UTF-8 and
UTF-16 codecs: an invalid code point is **tagged** with `errorMask` so it round-
trips losslessly rather than being silently dropped or mangled.

```ts
// fs/text/code_point/module.f.ts:17
export const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000
```

The UTF-8 *encoder* honors this contract: given an error-tagged / out-of-range
input it reconstructs the tagged bytes (`fs/text/utf8/module.f.ts:73-95`). The
UTF-16 *encoder* does the opposite — it silently truncates to 16 bits, losing the
error tag:

```ts
// fs/text/utf16/module.f.ts:109-118
const codePointToUtf16 = (codePoint: CodePoint): List<U16> => {
    if (isBmpCodePoint(codePoint)) { return [codePoint] }
    if (isSupplementaryPlane(codePoint)) {
        const n = codePoint - 0x1_0000
        const high = (n >> 10) + 0xd800
        const low = (n & 0b0011_1111_1111) + 0xdc00
        return [high, low]
    }
    return [codePoint & 0xffff]   // :117 — invalid input: mask to 16 bits, drop the error tag
}
```

So two encoders that share one `errorMask` contract handle the invalid case with
opposite philosophies: UTF-8 preserves+tags, UTF-16 discards. The UTF-16
*decoder* (`fs/text/utf16/module.f.ts:153` onward) does set `errorMask` on bad
input per its own JSDoc, so the encoder is the asymmetric side. `codePointToUtf16`
is used internally at `fs/text/utf16/module.f.ts:153` via `flatMap`.

This is a separation-of-concerns / contract-consistency gap rather than code
duplication: the rule for "what an encoder does with an invalid code point" should
live once in the `code_point` contract and be obeyed by both encoders.

## Proposal

1. Pin the contract in `fs/text/code_point/`'s JSDoc: invalid code points are
   passed through with `errorMask` set, as UTF-8 does.
2. Make `codePointToUtf16`'s final branch follow it instead of `& 0xffff` — emit a
   tagged representation that the UTF-16 decoder will recognize as an error, so
   encode→decode of an invalid input is stable.

No new abstraction is required; this aligns one module to the shared contract
module. **Verify first** against `fs/text/utf16/proof.f.ts` expectations — this
borders on a behavior change, so confirm the intended round-trip semantics before
editing (it may turn out the current truncation is deliberate, in which case the
resolution is to document *that* divergence in `code_point` instead).

## Tasks

- [ ] decide and document the invalid-code-point encoder contract in `code_point`
- [ ] align `codePointToUtf16`'s invalid branch (or document the deliberate divergence)
- [ ] add/adjust a `utf16/proof.f.ts` case for an invalid (error-tagged) input round-trip

## Related

- `fs/text/code_point/module.f.ts` — shared `errorMask` contract (:17)
- `fs/text/utf8/module.f.ts:73-95` — the encoder that preserves the tag (precedent)
- [i666-utf8-continuation-helpers](./666-utf8-continuation-helpers.md) — sibling utf8 cleanup
- [i168](./README.md) — the streaming decoder factory both codecs already share

---

