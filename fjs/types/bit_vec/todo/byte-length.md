## byte-length. Bits-to-bytes and "whole bytes" are open-coded at every consumer

**Priority:** P4
**Status:** open

### Problem

`fjs/types/bit_vec` derives `maxLengthBytes` from `maxLength` by `>> 3n`
and exports `length`, but neither a byte length nor an alignment predicate,
so every byte-oriented consumer spells both:

```js
// fjs/effects/node/module.f.mjs, inflate and writeLoop — same test, same message
(length(data) & 0b111n) !== 0n ? pureError(ioError({ message: 'invalid buffer size' })) : …
if ((lenV & 0b111n) !== 0n) { return pureError(ioError({ message: 'invalid buffer size' })) }
// fjs/effects/node/module.f.mjs, readChunks — the third spelling of the operator
if (bits % 8n !== 0n) { … }
// fjs/text/utf8/module.f.mjs                 // fjs/media/type/module.f.mjs
if ((length(v) & 0b111n) !== 0n) { return null }   if (utf8Text(s.utf8) && (s.length & 0b111n) === 0n) {
// fjs/basen/base64/module.f.mjs, encode      // fjs/git/oid/module.f.mjs, toHex
if (len % 8n !== 0n) { return null }          assert(bits !== 0n && bits % 8n === 0n, ['not whole bytes', oid])
```

and the conversion as `Number(bits >> 3n)`, `Number(lenV >> 3n)`,
`Number(length(chunk) / 8n)`, `length(body) >> 3n` and `s.length >> 3n`
across `effects/node`, `effects/node/virtual`, `cas`, `web` and
`media/type`. Three masks for one question, and the guards are exactly the
sites `readChunks`'s comment names as where a plausible wrong value would
come from.

### Proposal

The question is about a bit count, and one consumer holds only the count:
`fjs/media/type`'s `finish` reads `DetectState.length`, a running `bigint`,
because the vector is deliberately never buffered. So the primitives take
the count, and the `Vec` forms are one application each:

```ts
/** The whole bytes in `bits`; `bits` need not be a multiple of eight. */
export const bytesIn: (bits: bigint) => bigint
/** Whether `bits` is a whole number of bytes. */
export const isWholeBytesIn: (bits: bigint) => boolean
/** `bytesIn(length(v))`. */
export const byteLength: (v: Vec) => bigint
/** `isWholeBytesIn(length(v))`. */
export const isWholeBytes: (v: Vec) => boolean
```

`media/type`, `readChunks`'s `bits`, `base64`'s `encode` and `oid`'s
`toHex` use the count forms, each holding a length already; the sites that
hold a `Vec` use the other two. `toHex` keeps its own `bits !== 0n`, which
is a different question. `maxLengthBytes` becomes
`bytesIn(maxLength)`. One `invalidBufferSize` refusal in
`fjs/effects/node` serves the two sites that already share its message.

### Tasks

- [ ] The four exports with proofs, the count forms pinned at seven, eight
      and nine bits; the consumers in `effects/node`, `effects/node/virtual`,
      `cas`, `web`, `text/utf8`, `media/type`, `basen/base64` and `git/oid`
      over them, each in the form it holds; afterwards `& 0b111n`, `% 8n`
      and `>> 3n` over a bit count appear only in `fjs/types/bit_vec`.
- [ ] `tsc`, `fjs test`.

### Related

- [`../../../todo/unguarded-numeric-domains.md`](../../../todo/unguarded-numeric-domains.md) —
  the sibling concern for integer domains.
