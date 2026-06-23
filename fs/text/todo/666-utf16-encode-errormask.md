## 666-utf16-encode-errormask. `codePointToUtf16` discards the error tag instead of preserving it

**Priority:** P5
**Status:** open

### Problem

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

### Proposal

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

### Tasks

- [ ] decide and document the invalid-code-point encoder contract in `code_point`
- [ ] align `codePointToUtf16`'s invalid branch (or document the deliberate divergence)
- [ ] add/adjust a `utf16/proof.f.ts` case for an invalid (error-tagged) input round-trip

### Related

- `fs/text/code_point/module.f.ts` — shared `errorMask` contract (:17)
- `fs/text/utf8/module.f.ts:73-95` — the encoder that preserves the tag (precedent)
- i666-utf8-continuation-helpers — sibling utf8 cleanup
- [i168](./README.md) — the streaming decoder factory both codecs already share
