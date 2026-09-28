## 666-utf16-encode-errormask. `codePointToUtf16` discards the error tag instead of preserving it

**Priority:** P5
**Status:** open

### Problem

`fjs/text/code_point/module.f.mjs` defines a *shared* contract for the UTF-8 and
UTF-16 codecs: an invalid code point is **tagged** with `errorMask` so it round-
trips losslessly rather than being silently dropped or mangled.

```ts
// fjs/text/code_point/module.f.mjs, errorMask
export const errorMask = 0b1000_0000_0000_0000_0000_0000_0000_0000
```

The UTF-8 *encoder* honors this contract: given an error-tagged / out-of-range
input it reconstructs the tagged bytes (`codePointToUtf8` in
`fjs/text/utf8/module.f.mjs`, over the error flags beside it). The
UTF-16 *encoder* does the opposite — it silently truncates to 16 bits, losing the
error tag:

```js
// fjs/text/utf16/module.f.mjs, `codePointToUtf16`
const codePointToUtf16 = codePoint => {
    if (isBmpCodePoint(codePoint)) { return [codePoint] }
    const pair = tryToSurrogatePair(codePoint)
    // invalid input: mask to 16 bits, drop the error tag
    return pair === null ? [codePoint & 0xffff] : pair
}
```

So two encoders that share one `errorMask` contract handle the invalid case with
opposite philosophies: UTF-8 preserves+tags, UTF-16 discards. The UTF-16
*decoder* (`utf16ByteToCodePointOp` and `utf16StateToError` in
`fjs/text/utf16/module.f.mjs`) does set `errorMask` on bad input per its own
JSDoc, so the encoder is the asymmetric side. `codePointToUtf16` is used
internally by `fromCodePointList`, via `flatMap`, and by `codePointToString`.

This is a separation-of-concerns / contract-consistency gap rather than code
duplication: the rule for "what an encoder does with an invalid code point" should
live once in the `code_point` contract and be obeyed by both encoders.

### Proposal

1. Pin the contract in `fjs/text/code_point/`'s JSDoc: invalid code points are
   passed through with `errorMask` set, as UTF-8 does.
2. Make `codePointToUtf16`'s final branch follow it instead of `& 0xffff` — emit a
   tagged representation that the UTF-16 decoder will recognize as an error, so
   encode→decode of an invalid input is stable.

No new abstraction is required; this aligns one module to the shared contract
module. **Verify first** against `fjs/text/utf16/proof.f.mjs` expectations — this
borders on a behavior change, so confirm the intended round-trip semantics before
editing (it may turn out the current truncation is deliberate, in which case the
resolution is to document *that* divergence in `code_point` instead).

### Tasks

- [ ] decide and document the invalid-code-point encoder contract in `code_point`
- [ ] align `codePointToUtf16`'s invalid branch (or document the deliberate divergence)
- [ ] add/adjust a `utf16/proof.f.mjs` case for an invalid (error-tagged) input round-trip

### Related

- `fjs/text/code_point/module.f.mjs` — shared `errorMask` contract
- `fjs/text/utf8/module.f.mjs`, `codePointToUtf8` — the encoder that preserves
  the tag (precedent)
- i666-utf8-continuation-helpers — sibling utf8 cleanup
- [non-integer-code-points](./non-integer-code-points.md) — a non-integer code
  point is one more invalid input this contract has to cover, in both encoders
- [i168](../code_point/README.md#the-streaming-decoder-skeleton) — the
  streaming decoder factory both codecs already share; shipped as `decoder` in
  `fjs/text/code_point/module.f.mjs`
